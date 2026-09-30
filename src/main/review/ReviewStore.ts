import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { FileContent } from '@shared/domain/content';
import type { ReviewMark } from '@shared/domain/review';
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

/**
 * Review marks per workspace, kept in `<root>/<hash of the workspace path>/`: `marks.json` (path → fingerprint) and a
 * copy of each reviewed text file, named after the hash of its path. A workspace's folder goes away with its last mark.
 */
export class ReviewStore {
  private readonly files = new PersistedByKey<Marks>((workspacePath) =>
    readFile(this.marksPath(workspacePath), 'utf8')
      .then((json) => new Map(Object.entries(JSON.parse(json) as Record<string, StoredMark>)))
      .catch(() => new Map()),
  );

  constructor(private readonly root: string) {}

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
    await mkdir(this.directory(workspacePath), { recursive: true });
    for (const path of paths) {
      const { bytes, ...fingerprint } = await fingerprintFile(toAbsolutePath(workspacePath, path));
      const snapshot = bytes !== undefined && bytes.length <= MAX_SNAPSHOT_BYTES && !toFileContent(bytes, path).isBinary;
      if (snapshot) await writeFile(this.snapshotPath(workspacePath, path), bytes);
      else await rm(this.snapshotPath(workspacePath, path), { force: true });
      marks.set(path, { ...fingerprint, snapshot });
    }
    await this.save(workspacePath, marks);
  }

  async unmark(workspacePath: string, paths: string[]): Promise<void> {
    const marks = await this.files.load(workspacePath);
    const marked = paths.filter((path) => marks.has(path));
    if (marked.length === 0) return;
    for (const path of marked) {
      marks.delete(path);
      await rm(this.snapshotPath(workspacePath, path), { force: true });
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
    return toFileContent(await readFile(this.snapshotPath(workspacePath, path)), path);
  }

  /** Writes the marks as they are when the save's turn comes; without marks, the workspace's folder goes. */
  private save(workspacePath: string, marks: Marks): Promise<void> {
    return this.files.save(workspacePath, async () => {
      if (marks.size === 0) {
        await rm(this.directory(workspacePath), { recursive: true, force: true });
        return;
      }
      await mkdir(this.directory(workspacePath), { recursive: true });
      await writeFile(this.marksPath(workspacePath), JSON.stringify(Object.fromEntries(marks)));
    });
  }

  private directory(workspacePath: string): string {
    return join(this.root, hashOf(workspacePath).slice(0, 16));
  }

  private marksPath(workspacePath: string): string {
    return join(this.directory(workspacePath), 'marks.json');
  }

  private snapshotPath(workspacePath: string, path: string): string {
    return join(this.directory(workspacePath), hashOf(path));
  }
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
