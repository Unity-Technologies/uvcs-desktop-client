import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { FileContent } from '@shared/domain/content';
import type { ReviewMark } from '@shared/domain/review';
import type { WorkspaceGuid } from '@shared/domain/stableIds';
import { toFileContent } from '../files/fileContent';
import { toAbsolutePath } from '../files/workspacePaths';
import { fingerprintFile, looksUnchanged, type Fingerprint } from './fingerprint';
import { PersistedByKey } from './PersistedByKey';

/** Larger texts are not copied: showing what changed since the review is for files one reads. */
const MAX_SNAPSHOT_BYTES = 2 * 1024 * 1024;

interface StoredMark extends Fingerprint {
  /** A copy of the reviewed text sits next to the marks. */
  snapshot: boolean;
}

type Marks = Map<string, StoredMark>;

/** The workspace's GUID (`WorkspaceHeaders.names`, a local read the workspace's window already made); undefined when `cm` printed none. */
export type WorkspaceGuidOf = (workspacePath: string) => Promise<WorkspaceGuid | undefined>;

/**
 * Review marks per workspace, kept in `<root>/<workspace GUID>/`, which a rename or a move of the workspace keeps
 * (ARCHITECTURE.md "Settings survive renames"): `marks.json` (path → fingerprint) and a copy of each reviewed text file,
 * named after the hash of its path. A workspace's folder goes away with its last mark. Marks were once kept by the hash
 * of the workspace's path: such a folder moves to the GUID's the first time the workspace's marks are read.
 */
export class ReviewStore {
  private readonly files = new PersistedByKey<Marks>(async (workspacePath) => {
    const marksPath = await this.marksPath(workspacePath);
    return readFile(marksPath, 'utf8')
      .then((json) => new Map(Object.entries(JSON.parse(json) as Record<string, StoredMark>)))
      .catch(() => new Map());
  });
  /** Each workspace's folder, by its path: found once per path, as a GUID never changes. */
  private readonly folders = new Map<string, Promise<string>>();

  constructor(
    private readonly root: string,
    private readonly guidOf: WorkspaceGuidOf,
  ) {}

  async marks(workspacePath: string): Promise<ReviewMark[]> {
    const marks = await this.files.load(workspacePath);
    const checked = await Promise.all(
      [...marks].map(async ([path, stored]) => ({ path, stored, ...(await stillReviewed(toAbsolutePath(workspacePath, path), stored)) })),
    );
    for (const { path, refreshed } of checked) if (refreshed) marks.set(path, refreshed);
    if (checked.some(({ refreshed }) => refreshed)) await this.save(workspacePath, marks);
    return checked.map(({ path, stored, reviewed }) => ({ path, state: reviewed ? 'reviewed' : 'changedSinceReview', hasSnapshot: stored.snapshot }));
  }

  async mark(workspacePath: string, paths: string[]): Promise<void> {
    const marks = await this.files.load(workspacePath);
    const directory = await this.directory(workspacePath);
    await mkdir(directory, { recursive: true });
    for (const path of paths) {
      const { bytes, ...fingerprint } = await fingerprintFile(toAbsolutePath(workspacePath, path));
      const snapshot = bytes !== undefined && bytes.length <= MAX_SNAPSHOT_BYTES && !toFileContent(bytes, path).isBinary;
      if (snapshot) await writeFile(snapshotPath(directory, path), bytes);
      else await rm(snapshotPath(directory, path), { force: true });
      marks.set(path, { ...fingerprint, snapshot });
    }
    await this.save(workspacePath, marks);
  }

  async unmark(workspacePath: string, paths: string[]): Promise<void> {
    const marks = await this.files.load(workspacePath);
    const marked = paths.filter((path) => marks.has(path));
    if (marked.length === 0) return;
    const directory = await this.directory(workspacePath);
    for (const path of marked) {
      marks.delete(path);
      await rm(snapshotPath(directory, path), { force: true });
    }
    await this.save(workspacePath, marks);
  }

  async keepOnly(workspacePath: string, pendingPaths: string[]): Promise<void> {
    const pending = new Set(pendingPaths);
    const marks = await this.files.load(workspacePath);
    await this.unmark(workspacePath, [...marks.keys()].filter((path) => !pending.has(path)));
  }

  async readSnapshot(workspacePath: string, path: string): Promise<FileContent> {
    const stored = (await this.files.load(workspacePath)).get(path);
    if (!stored?.snapshot) throw new Error(`No reviewed copy of ${path} was kept.`);
    return toFileContent(await readFile(snapshotPath(await this.directory(workspacePath), path)), path);
  }

  /** Writes the marks as they are when the save's turn comes; without marks, the workspace's folder goes. */
  private save(workspacePath: string, marks: Marks): Promise<void> {
    return this.files.save(workspacePath, async () => {
      const directory = await this.directory(workspacePath);
      if (marks.size === 0) {
        await rm(directory, { recursive: true, force: true });
        return;
      }
      await mkdir(directory, { recursive: true });
      await writeFile(join(directory, MARKS_FILE), JSON.stringify(Object.fromEntries(marks)));
    });
  }

  /** The workspace's folder: its GUID's, or its path's hash when `cm` prints no GUID. A failed read isn't kept. */
  private directory(workspacePath: string): Promise<string> {
    let folder = this.folders.get(workspacePath);
    if (!folder) {
      const found = this.findFolder(workspacePath);
      found.catch(() => this.folders.get(workspacePath) === found && this.folders.delete(workspacePath));
      this.folders.set(workspacePath, (folder = found));
    }
    return folder;
  }

  private async marksPath(workspacePath: string): Promise<string> {
    return join(await this.directory(workspacePath), MARKS_FILE);
  }

  /** The GUID's folder, taking over the one kept by the workspace's path before, if any and if it has none yet. */
  private async findFolder(workspacePath: string): Promise<string> {
    const byPath = join(this.root, hashOf(workspacePath).slice(0, 16));
    const guid = await this.guidOf(workspacePath);
    if (!guid) return byPath;
    const byGuid = join(this.root, guid);
    // Without a folder kept by its path, there is nothing to move.
    if (!(await exists(byGuid))) await rename(byPath, byGuid).catch(() => undefined);
    return byGuid;
  }
}

const MARKS_FILE = 'marks.json';

function snapshotPath(directory: string, path: string): string {
  return join(directory, hashOf(path));
}

function exists(path: string): Promise<boolean> {
  return stat(path).then(
    () => true,
    () => false,
  );
}

/**
 * Whether a file still holds what was reviewed. One touched but holding the same contents is `refreshed` with its new
 * size and time, so the next check needn't read it again.
 */
async function stillReviewed(absolutePath: string, stored: StoredMark): Promise<{ reviewed: boolean; refreshed?: StoredMark }> {
  if (await looksUnchanged(absolutePath, stored)) return { reviewed: true };
  // Touched, maybe rewritten with the same contents: only the hash tells.
  const current = await fingerprintFile(absolutePath);
  if (current.hash !== stored.hash) return { reviewed: false };
  return { reviewed: true, refreshed: { ...stored, size: current.size, mtimeMs: current.mtimeMs } };
}

function hashOf(text: string): string {
  return createHash('sha1').update(text).digest('hex');
}
