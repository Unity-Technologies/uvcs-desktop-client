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
import { catArgs, catBatchesOf, type CatRead } from '../cm/catBatches';
import { MAX_MODEL_BYTES } from '../files/fileContent';
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
/** A revision of unknown size counts as this much in a batch. */
const UNKNOWN_SIZE = 1024 * 1024;

interface RevisionDownloadsOptions {
  cm: Pick<CmClient, 'execute'>;
  /** Reads a revision from the workspace's disk where its file there has the revision's content. */
  copies?: Pick<WorkspaceCopies, 'read'>;
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
  private readonly copies: Pick<WorkspaceCopies, 'read'>;
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
  /** Downloads asked for or under way, by revision: a revision is downloaded once however many ask. */
  private readonly downloading = new Map<string, Promise<string>>();
  private waiting: Waiting[] = [];
  /** Reads still checking the disk: the reads asked at once go in one batch, so it waits for them. */
  private checking = 0;
  private scheduled = false;

  constructor({ cm, copies = new WorkspaceCopies(), tempFolder = tmpdir(), maxKeptBytes = MAX_KEPT_BYTES, schedule = (run) => void setImmediate(run), pid = process.pid, isRunning = processIsRunning, removeFolder = (folder) => rmSync(folder, { recursive: true, force: true }) }: RevisionDownloadsOptions) {
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
    this.checking++;
    let checked = false;
    const doneChecking = () => {
      if (checked) return;
      checked = true;
      this.checking--;
      this.downloadWhenAllChecked();
    };
    try {
      const onDisk = await this.copies.read(workspacePath, file);
      if (onDisk) return onDisk;
      const key = keyOf(file.revision);
      const kept = this.kept.get(key);
      if (kept) {
        const bytes = await readFile(kept.target).catch(() => null);
        if (bytes) return this.touch(key, kept), bytes;
        this.forget(key);
      }
      if (!this.downloading.has(key) && !mayDownload()) throw new Error(`${file.path} is past what is downloaded for one lookup`);
      // Past what is read, known by its size: refused before downloading it for nothing.
      if (file.size > MAX_MODEL_BYTES) throw new Error(`${file.path} is too large to read`);
      const downloaded = this.download(workspacePath, file, key);
      doneChecking();
      // A batch bigger than what is kept may let go of a download before its read reads it: it's downloaded again.
      return await readCapped(await downloaded).catch(async (error: unknown) => {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        this.forget(key);
        return readCapped(await this.download(workspacePath, file, key));
      });
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
      .then(() => this.cm.execute(catArgs(batch.map((one) => catReadOf(one, folder))), { cwd: batch[0]!.workspacePath }))
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
    for (const oldest of this.kept.keys()) {
      if (this.keptBytes <= this.maxKeptBytes || oldest === key) break;
      this.forget(oldest, true);
    }
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

/** Whether a process is running: signal 0 checks without sending one (`EPERM`: it runs, as another user's). */
function processIsRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
}

/**
 * The waiting reads in batches of one `cm cat` each (`catBatchesOf`): one workspace each (`cm` runs in it), within
 * `MAX_BATCH_BYTES`, a revision of unknown size counting as `UNKNOWN_SIZE`.
 */
export function batchesOf<T extends { workspacePath: string; file: Pick<RevisionFile, 'revision' | 'size'>; target: string }>(waiting: readonly T[], folder: string): T[][] {
  const byWorkspace = new Map<string, T[]>();
  for (const one of waiting) {
    const reads = byWorkspace.get(one.workspacePath);
    if (reads) reads.push(one);
    else byWorkspace.set(one.workspacePath, [one]);
  }
  return [...byWorkspace.values()].flatMap((reads) => catBatchesOf(reads, (one) => catReadOf(one, folder), { maxBytes: MAX_BATCH_BYTES, unknownSize: UNKNOWN_SIZE }));
}

/** A waiting read as `cm cat` takes it: its revision, into its file in the session's folder. */
export function catReadOf({ file, target }: { file: Pick<RevisionFile, 'revision' | 'size'>; target: string }, folder: string): CatRead {
  return { spec: spec.revision(file.revision), repository: file.revision.repository, target: join(folder, target), size: file.size };
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
