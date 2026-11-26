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

/** A workspace's marks, and the folder they're kept in. */
interface WorkspaceMarks {
  directory: string;
  marks: Marks;
}

/** The workspace's GUID (`WorkspaceHeaders.names`, a local read the workspace's window already made); undefined when `cm` printed none. */
export type WorkspaceGuidOf = (workspacePath: string) => Promise<WorkspaceGuid | undefined>;

/**
 * Review marks per workspace, kept in `<root>/<workspace GUID>/`, which a rename or a move of the workspace keeps
 * (ARCHITECTURE.md "Settings survive renames"): `marks.json` (path → fingerprint) and a copy of each reviewed text file,
 * named after the hash of its path. A workspace's folder goes away with its last mark. Marks were once kept by the hash
 * of the workspace's path: such a folder moves to the GUID's the first time the workspace's marks are read.
 */
export class ReviewStore {
  /** Read once per workspace path, folder and marks together; a read that fails (its GUID couldn't be read) is tried again. */
  private readonly files = new PersistedByKey<WorkspaceMarks>(async (workspacePath) => {
    const directory = await this.findFolder(workspacePath);
    const marks: Marks = await readFile(join(directory, MARKS_FILE), 'utf8')
      .then((json) => new Map(Object.entries(JSON.parse(json) as Record<string, StoredMark>)))
      .catch(() => new Map());
    return { directory, marks };
  });

  constructor(
    private readonly root: string,
    private readonly guidOf: WorkspaceGuidOf,
  ) {}

  async marks(workspacePath: string): Promise<ReviewMark[]> {
    const kept = await this.files.load(workspacePath);
    const checked = await Promise.all(
      [...kept.marks].map(async ([path, stored]) => ({ path, stored, ...(await stillReviewed(toAbsolutePath(workspacePath, path), stored)) })),
    );
    for (const { path, refreshed } of checked) if (refreshed) kept.marks.set(path, refreshed);
    if (checked.some(({ refreshed }) => refreshed)) await this.save(workspacePath, kept);
    return checked.map(({ path, stored, reviewed }) => ({ path, state: reviewed ? 'reviewed' : 'changedSinceReview', hasSnapshot: stored.snapshot }));
  }

  async mark(workspacePath: string, paths: string[]): Promise<void> {
    const kept = await this.files.load(workspacePath);
    await mkdir(kept.directory, { recursive: true });
    for (const path of paths) {
      const { bytes, ...fingerprint } = await fingerprintFile(toAbsolutePath(workspacePath, path));
      const snapshot = bytes !== undefined && bytes.length <= MAX_SNAPSHOT_BYTES && !toFileContent(bytes, path).isBinary;
      if (snapshot) await writeFile(snapshotPath(kept.directory, path), bytes);
      else await rm(snapshotPath(kept.directory, path), { force: true });
      kept.marks.set(path, { ...fingerprint, snapshot });
    }
    await this.save(workspacePath, kept);
  }

  async unmark(workspacePath: string, paths: string[]): Promise<void> {
    const kept = await this.files.load(workspacePath);
    const marked = paths.filter((path) => kept.marks.has(path));
    if (marked.length === 0) return;
    for (const path of marked) {
      kept.marks.delete(path);
      await rm(snapshotPath(kept.directory, path), { force: true });
    }
    await this.save(workspacePath, kept);
  }

  async keepOnly(workspacePath: string, pendingPaths: string[]): Promise<void> {
    const pending = new Set(pendingPaths);
    const { marks } = await this.files.load(workspacePath);
    await this.unmark(workspacePath, [...marks.keys()].filter((path) => !pending.has(path)));
  }

  async readSnapshot(workspacePath: string, path: string): Promise<FileContent> {
    const { directory, marks } = await this.files.load(workspacePath);
    if (!marks.get(path)?.snapshot) throw new Error(`No reviewed copy of ${path} was kept.`);
    return toFileContent(await readFile(snapshotPath(directory, path)), path);
  }

  /** Writes the marks as they are when the save's turn comes; without marks, the workspace's folder goes. */
  private save(workspacePath: string, { directory, marks }: WorkspaceMarks): Promise<void> {
    return this.files.save(workspacePath, async () => {
      if (marks.size === 0) {
        await rm(directory, { recursive: true, force: true });
        return;
      }
      await mkdir(directory, { recursive: true });
      await writeFile(join(directory, MARKS_FILE), JSON.stringify(Object.fromEntries(marks)));
    });
  }

  /**
   * The workspace's folder: its GUID's, taking over the one kept by the workspace's path before, if any and if it has
   * none yet; its path's hash when `cm` prints no GUID.
   */
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
