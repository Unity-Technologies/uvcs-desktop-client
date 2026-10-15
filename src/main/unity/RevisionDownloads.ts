// Revisions of files the Materials look needs at a version's point (textures, `.mat` and `.meta` files), read as
// cheaply as the server allows (docs/features/model-diff.md, "Materials"): from the workspace's disk when its file
// there has the revision's content (the hash `cm ls` listed), else downloaded with every other read asked at once in
// one `cm cat <spec>;<file> <spec>;<file> …`, which downloads them in one batch. What was downloaded is kept for the
// session in a folder of its own under the OS's temp folder, the latest `MAX_KEPT_BYTES` of it, and deleted as the
// app quits (`dispose`), or as the next one starts after a crash (`removeLeftOverDownloads`).

import { createHash } from 'node:crypto';
import { rmSync } from 'node:fs';
import { mkdir, mkdtemp, readdir, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { RevisionRef } from '@shared/domain/revision';
import { spec } from '@shared/domain/specs';
import type { CmClient } from '../cm/CmClient';
import { commandLineLength, MAX_COMMAND_LINE } from '../cm/commandLineLimit';
import { MAX_MODEL_BYTES } from '../files/fileContent';
import { processIsRunning } from '../system/processIsRunning';
import { contentHashOf, WorkspaceCopies, type RevisionFile } from '../files/WorkspaceCopies';

/**
 * The session's downloads folders, under the OS's temp folder, named with the process that owns them
 * (`uvcs-revisions-<pid>-…`): one whose process is gone was left over. Two apps may run at once (a development build
 * beside the installed one, each with its profile), so the owner, never "any other", tells.
 */
const FOLDER_PREFIX = 'uvcs-revisions-';
/** The most bytes of downloads kept for the session; the oldest go first. */
export const MAX_KEPT_BYTES = 1024 * 1024 * 1024;
/**
 * The most bytes one `cm cat` downloads (by the sizes listed): bigger batches cost fewer round trips, smaller ones
 * show the first textures sooner.
 */
export const MAX_BATCH_BYTES = 64 * 1024 * 1024;
/**
 * How long a revision fetched ahead (`fetch`) is kept past `MAX_KEPT_BYTES` while it waits for its read: a look reads
 * its textures a few at a time, and one let go first would be downloaded again on its own. One never read (the look
 * left) goes after this.
 */
export const FETCHED_KEPT_MS = 5 * 60_000;
/** The failed fetches remembered, so their reads fail at once, before starting over. */
const MAX_FAILED_FETCHES = 1000;
/** A revision of unknown size counts as this much in a batch. */
const UNKNOWN_SIZE = 1024 * 1024;

interface RevisionDownloadsOptions {
  cm: Pick<CmClient, 'execute'>;
  /** Reads a revision from the workspace's disk where its file there has the revision's content. */
  copies?: Pick<WorkspaceCopies, 'read' | 'has'>;
  /** The folder the session's downloads folder is made in, the first time something is downloaded: the OS's temp folder. */
  tempFolder?: string;
  maxKeptBytes?: number;
  /** Runs the downloads asked so far: after the reads asked at once are in (IPC calls arriving together). */
  schedule?: (run: () => void) => void;
  /** This process's id, and whether another is running: what tells a folder left over from one in use. */
  pid?: number;
  isRunning?: (pid: number) => boolean;
  /** Deletes the session's folder as the app quits; tests pass one that fails, as Windows may (a file held). */
  removeFolder?: (folder: string) => void;
  /** The clock that tells how long a fetched revision has waited for its read. */
  now?: () => number;
}

interface Waiting {
  workspacePath: string;
  file: RevisionFile;
  key: string;
  /** Its file's name in the session's folder: one per download, so one let go and its download again never meet. */
  target: string;
  resolve: (target: string) => void;
  reject: (error: unknown) => void;
}

export class RevisionDownloads {
  private readonly cm: Pick<CmClient, 'execute'>;
  private readonly copies: Pick<WorkspaceCopies, 'read' | 'has'>;
  private readonly tempFolder: string;
  private leftOvers: Promise<void> | null = null;
  private readonly pid: number;
  private readonly isRunning: (pid: number) => boolean;
  private readonly removeFolder: (folder: string) => void;
  private downloads = 0;
  private readonly maxKeptBytes: number;
  private readonly schedule: (run: () => void) => void;
  private folder: Promise<string> | null = null;
  private folderMade: string | null = null;
  /** Downloaded files by revision, oldest first, with their sizes. */
  private readonly kept = new Map<string, { target: string; size: number }>();
  private keptBytes = 0;
  /** Revisions fetched ahead and not read yet, with when: kept past the budget until read (`FETCHED_KEPT_MS`). */
  private readonly fetched = new Map<string, number>();
  /** Why the fetch of a revision failed, until it is fetched again: its read fails at once, never downloading it alone. */
  private readonly failedFetches = new Map<string, unknown>();
  private readonly now: () => number;
  /** Downloads asked for or under way, by revision: a revision is downloaded once however many ask. */
  private readonly downloading = new Map<string, Promise<string>>();
  private waiting: Waiting[] = [];
  /** Reads still checking the disk: the reads asked at once go in one batch, so it waits for them. */
  private checking = 0;
  private scheduled = false;

  constructor({ cm, copies = new WorkspaceCopies(), tempFolder = tmpdir(), maxKeptBytes = MAX_KEPT_BYTES, schedule = (run) => void setImmediate(run), pid = process.pid, isRunning = processIsRunning, removeFolder = (folder) => rmSync(folder, { recursive: true, force: true }), now = Date.now }: RevisionDownloadsOptions) {
    this.now = now;
    this.removeFolder = removeFolder;
    this.pid = pid;
    this.isRunning = isRunning;
    this.cm = cm;
    this.copies = copies;
    this.tempFolder = tempFolder;
    this.maxKeptBytes = maxKeptBytes;
    this.schedule = schedule;
  }

  /**
   * The revision's bytes: the disk's file where it has them, else downloaded (once), if `mayDownload` says so (a
   * budget). Rejects when it can't be read.
   */
  async read(workspacePath: string, file: RevisionFile, mayDownload: () => boolean = () => true): Promise<Buffer> {
    return this.whileChecking(async (doneChecking) => {
      const onDisk = await this.copies.read(workspacePath, file);
      if (onDisk) return onDisk;
      const key = keyOf(file.revision);
      const kept = this.kept.get(key);
      if (kept) {
        const bytes = await readFile(kept.target).catch(() => null);
        if (bytes) return this.touch(key, kept), this.wasRead(key), bytes;
        this.forget(key);
      }
      if (this.failedFetches.has(key)) throw this.failedFetches.get(key);
      if (!this.downloading.has(key) && !mayDownload()) throw new Error(`${file.path} is past what is downloaded for one lookup`);
      // Past what is read, known by its size: refused before downloading it for nothing.
      if (file.size > MAX_MODEL_BYTES) throw new Error(`${file.path} is too large to read`);
      const downloaded = this.download(workspacePath, file, key);
      doneChecking();
      // A batch bigger than what is kept may let go of a download before its read reads it: it's downloaded again.
      const bytes = await readCapped(await downloaded).catch(async (error: unknown) => {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        this.forget(key);
        return readCapped(await this.download(workspacePath, file, key));
      });
      this.wasRead(key);
      return bytes;
    });
  }

  /**
   * Has the revision ready for a read to come, reading none of it: on the disk (checked as a read checks it), kept, or
   * downloaded now in one batch with the others asked at once. A reader that reads a few files at a time, to hold few
   * in memory (the Materials look's textures), asks for them all here first, so its reads never split the batch.
   * Fails as the read would, and its read then fails at once (until it is fetched again); kept past `MAX_KEPT_BYTES`
   * until read, or `FETCHED_KEPT_MS`. A revision past what is read is left for the read to refuse.
   */
  async fetch(workspacePath: string, file: RevisionFile): Promise<void> {
    const key = keyOf(file.revision);
    this.failedFetches.delete(key);
    return this.whileChecking(async (doneChecking) => {
      if (await this.copies.has(workspacePath, file)) return;
      const kept = this.kept.get(key);
      if (kept) return this.touch(key, kept), void this.fetched.set(key, this.now());
      if (file.size > MAX_MODEL_BYTES) return;
      this.fetched.set(key, this.now());
      const downloaded = this.download(workspacePath, file, key);
      doneChecking();
      await downloaded.catch((error: unknown) => {
        this.fetched.delete(key);
        if (this.failedFetches.size >= MAX_FAILED_FETCHES) this.failedFetches.clear();
        this.failedFetches.set(key, error);
        throw error;
      });
    });
  }

  /** A fetched revision read: it is kept as any other now, the oldest going past the budget. */
  private wasRead(key: string): void {
    if (this.fetched.delete(key)) this.letGoPastBudget();
  }

  /**
   * Runs a read's work as one still checking the disk (`checking`) until it says it's done (or ends): the downloads
   * asked meanwhile wait for it, so the reads asked at once go in one batch.
   */
  private async whileChecking<T>(work: (doneChecking: () => void) => Promise<T>): Promise<T> {
    this.checking++;
    let checked = false;
    const doneChecking = () => {
      if (checked) return;
      checked = true;
      this.checking--;
      this.downloadWhenAllChecked();
    };
    try {
      return await work(doneChecking);
    } finally {
      doneChecking();
    }
  }

  /**
   * Deletes the downloads folders a session left as it crashed or was killed: those whose process is gone. Another
   * app's running now (a development build beside the installed one) stays. This session's own is made once they're gone.
   */
  removeLeftOvers(): Promise<void> {
    this.leftOvers ??= readdir(this.tempFolder).then(
      (names) => Promise.all(names.filter((name) => this.isLeftOver(name)).map((name) => rm(join(this.tempFolder, name), { recursive: true, force: true }).catch(() => undefined))).then(() => undefined),
      () => undefined,
    );
    return this.leftOvers;
  }

  private isLeftOver(name: string): boolean {
    const owner = new RegExp(`^${FOLDER_PREFIX}(\\d+)-`).exec(name);
    if (!owner) return false;
    const pid = Number(owner[1]);
    return pid !== this.pid && !this.isRunning(pid);
  }

  /**
   * Deletes the session's downloads, at once: the app is quitting. A file Windows still holds (an antivirus, a `cm cat`
   * not done) leaves the folder for the next session (`removeLeftOvers`): quitting never fails for it.
   */
  dispose(): void {
    if (!this.folderMade) return;
    try {
      this.removeFolder(this.folderMade);
    } catch {
      // The next session deletes it.
    }
  }

  private download(workspacePath: string, file: RevisionFile, key: string): Promise<string> {
    const under = this.downloading.get(key);
    if (under) return under;
    const target = `${fileNameOf(key)}-${++this.downloads}`;
    const started = new Promise<string>((resolve, reject) => this.waiting.push({ workspacePath, file, key, target, resolve, reject })).finally(() => this.downloading.delete(key));
    this.downloading.set(key, started);
    this.downloadWhenAllChecked();
    return started;
  }

  /** Starts the downloads waiting once no read asked with them is still checking the disk. */
  private downloadWhenAllChecked(): void {
    if (this.scheduled || this.checking > 0 || this.waiting.length === 0) return;
    this.scheduled = true;
    this.schedule(() => {
      this.scheduled = false;
      if (this.checking === 0) void this.downloadWaiting();
    });
  }

  /** Downloads what is waiting, in batches of one `cm cat` each. */
  private async downloadWaiting(): Promise<void> {
    const waiting = this.waiting;
    this.waiting = [];
    let folder: string;
    try {
      folder = await this.sessionFolder();
    } catch (error) {
      return waiting.forEach((one) => one.reject(error));
    }
    await Promise.all(batchesOf(waiting, folder).map((batch) => this.downloadBatch(batch, folder)));
  }

  /**
   * One `cm cat` of the batch. `cm cat` writes every revision it found even when another failed: each is told on its
   * own. After a failure, a file is kept only when it is whole as far as the listing tells (its size, its hash): one
   * cut short by a dropped connection would serve a broken texture for the session. Those that can't be told (a diff's
   * side before, size and hash unknown) are downloaded again once, together (`retried`); failing again, they fail.
   */
  private async downloadBatch(batch: Waiting[], folder: string, retried = false): Promise<void> {
    const targets = batch.map((one) => join(folder, one.target));
    // The OS's cleaning (macOS's of folders idle for days, systemd-tmpfiles) may have taken the folder meanwhile.
    const failure = await mkdir(folder, { recursive: true })
      .then(() => this.cm.execute(catArgs(batch, folder), { cwd: batch[0]!.workspacePath }))
      .then(
        () => null,
        (error: unknown) => error,
      );
    const again: Waiting[] = [];
    await Promise.all(
      batch.map(async (one, i) => {
        const size = await stat(targets[i]!).then((stats) => stats.size, () => null);
        if (size === null) return one.reject(failure ?? new Error(`${one.file.path} wasn't downloaded`));
        const whole = failure === null || (await isWhole(one.file, targets[i]!, size));
        if (whole) return this.keep(one.key, { target: targets[i]!, size }), one.resolve(targets[i]!);
        await rm(targets[i]!, { force: true }).catch(() => undefined);
        if (!retried && !canTellWhole(one.file)) again.push({ ...one, target: `${one.target}-again` });
        else one.reject(failure);
      }),
    );
    if (again.length > 0) await this.downloadBatch(again, folder, true);
  }

  private sessionFolder(): Promise<string> {
    this.folder ??= this.removeLeftOvers()
      .then(() => mkdtemp(join(this.tempFolder, `${FOLDER_PREFIX}${this.pid}-`)))
      .then(
      (made) => (this.folderMade = made),
      (error: unknown) => {
        this.folder = null;
        throw error;
      },
    );
    return this.folder;
  }

  private keep(key: string, file: { target: string; size: number }): void {
    this.forget(key);
    this.kept.set(key, file);
    this.keptBytes += file.size;
    this.letGoPastBudget(key);
  }

  /** Lets go of the oldest downloads past `maxKeptBytes`, but `latest` and those fetched waiting for their read. */
  private letGoPastBudget(latest?: string): void {
    for (const oldest of this.kept.keys()) {
      if (this.keptBytes <= this.maxKeptBytes) break;
      if (oldest === latest || this.isWaitingForRead(oldest)) continue;
      this.forget(oldest, true);
    }
  }

  private isWaitingForRead(key: string): boolean {
    const since = this.fetched.get(key);
    if (since === undefined) return false;
    if (this.now() - since < FETCHED_KEPT_MS) return true;
    this.fetched.delete(key);
    return false;
  }

  private touch(key: string, file: { target: string; size: number }): void {
    this.kept.delete(key);
    this.kept.set(key, file);
  }

  private forget(key: string, deleteFile = false): void {
    const kept = this.kept.get(key);
    if (!kept) return;
    this.kept.delete(key);
    this.keptBytes -= kept.size;
    if (deleteFile) void rm(kept.target, { force: true }).catch(() => undefined);
  }
}

/**
 * The waiting reads in batches: one workspace (`cm` runs in it) and one repository each (an xlinked repository's
 * revisions apart: `cm cat` resolves each repository's on its own), within `MAX_BATCH_BYTES` (one revision past it goes
 * alone) and a command line Windows can start. A folder holding `;` can't be named in `<spec>;<file>`: then each
 * revision goes alone, as `--file=`.
 */
export function batchesOf<T extends { workspacePath: string; file: Pick<RevisionFile, 'revision' | 'size'>; target: string }>(waiting: readonly T[], folder: string): T[][] {
  const batches: T[][] = [];
  const byWorkspace = new Map<string, T[]>();
  for (const one of waiting) {
    const key = JSON.stringify([one.workspacePath, one.file.revision.repository]);
    const reads = byWorkspace.get(key);
    if (reads) reads.push(one);
    else byWorkspace.set(key, [one]);
  }
  // The command line grows by each revision's argument: measured one at a time, not the whole batch again for each.
  const catLength = commandLineLength(['cat']);
  for (const reads of byWorkspace.values()) {
    let batch: T[] = [];
    let bytes = 0;
    let length = catLength;
    for (const one of reads) {
      const size = one.file.size >= 0 ? one.file.size : UNKNOWN_SIZE;
      const argLength = commandLineLength(catArgs([one], folder).slice(1)); // Its own arguments, past `cat`.
      if (batch.length > 0 && (folder.includes(';') || bytes + size > MAX_BATCH_BYTES || length + argLength > MAX_COMMAND_LINE)) {
        batches.push(batch);
        batch = [];
        bytes = 0;
        length = catLength;
      }
      batch.push(one);
      bytes += size;
      length += argLength;
    }
    if (batch.length > 0) batches.push(batch);
  }
  return batches;
}

/** `cm cat` of the batch's revisions, each into its file in the folder. */
export function catArgs(batch: readonly { file: Pick<RevisionFile, 'revision'>; target: string }[], folder: string): string[] {
  const [only] = batch;
  if (folder.includes(';') && only) return ['cat', spec.revision(only.file.revision), `--file=${join(folder, only.target)}`];
  return ['cat', ...batch.map((one) => `${spec.revision(one.file.revision)};${join(folder, one.target)}`)];
}

/** Whether a file written by a `cm cat` that failed is whole: its size and hash as listed, where known; else not. */
async function isWhole(file: RevisionFile, target: string, size: number): Promise<boolean> {
  if (!canTellWhole(file) || (file.size >= 0 && size !== file.size)) return false;
  return file.hash === null || contentHashOf(await readFile(target)) === file.hash;
}

function canTellWhole(file: RevisionFile): boolean {
  return file.size >= 0 || file.hash !== null;
}

function keyOf(revision: RevisionRef): string {
  return `${revision.revisionId}@${revision.repository}`;
}

/** A file name for a revision's download, from its id and repository: no separator, no `;`, one per revision. */
function fileNameOf(key: string): string {
  return createHash('sha1').update(key).digest('hex');
}

async function readCapped(target: string): Promise<Buffer> {
  const { size } = await stat(target);
  if (size > MAX_MODEL_BYTES) throw new Error(`${target} is too large to read`);
  return readFile(target);
}
