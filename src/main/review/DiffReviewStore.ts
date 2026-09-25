import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { DiffReviewMark } from '@shared/domain/review';

/** Diffs remembered per repository; the least recently used go first. */
export const MAX_DIFFS_PER_REPOSITORY = 200;

interface StoredDiff {
  usedAt: number;
  /** Path → the revision reviewed. */
  marks: Record<string, number>;
}

type RepositoryMarks = Record<string, StoredDiff>;

/**
 * Review marks of committed diffs (a changeset, a branch, a shelve...), per repository in `<root>/<hash of the repository>.json`.
 * History doesn't change, so a mark is the revision reviewed: a file is changed since its review when the diff now shows
 * another revision of it, e.g. after new changesets on a branch.
 */
export class DiffReviewStore {
  private readonly loaded = new Map<string, Promise<RepositoryMarks>>();
  private readonly saves = new Map<string, Promise<void>>();

  constructor(
    private readonly root: string,
    private readonly now: () => number = Date.now,
  ) {}

  async marks(repository: string, diff: string): Promise<DiffReviewMark[]> {
    const stored = (await this.load(repository))[diff];
    return Object.entries(stored?.marks ?? {}).map(([path, revisionId]) => ({ path, revisionId }));
  }

  async mark(repository: string, diff: string, marks: DiffReviewMark[]): Promise<void> {
    await this.update(repository, diff, (current) => ({ ...current, ...Object.fromEntries(marks.map((mark) => [mark.path, mark.revisionId])) }));
  }

  async unmark(repository: string, diff: string, paths: string[]): Promise<void> {
    const unmarked = new Set(paths);
    await this.update(repository, diff, (current) => Object.fromEntries(Object.entries(current).filter(([path]) => !unmarked.has(path))));
  }

  private async update(repository: string, diff: string, change: (marks: Record<string, number>) => Record<string, number>): Promise<void> {
    const repositoryMarks = await this.load(repository);
    const marks = change(repositoryMarks[diff]?.marks ?? {});
    if (Object.keys(marks).length === 0) delete repositoryMarks[diff];
    else repositoryMarks[diff] = { usedAt: this.now(), marks };
    forgetLeastRecentlyUsed(repositoryMarks);
    await this.save(repository, repositoryMarks);
  }

  private load(repository: string): Promise<RepositoryMarks> {
    let marks = this.loaded.get(repository);
    if (!marks) {
      marks = readFile(this.filePath(repository), 'utf8')
        .then((json) => JSON.parse(json) as RepositoryMarks)
        .catch(() => ({}));
      this.loaded.set(repository, marks);
    }
    return marks;
  }

  /** Writes one save after another, so an older state never lands last. */
  private save(repository: string, marks: RepositoryMarks): Promise<void> {
    const previous = this.saves.get(repository) ?? Promise.resolve();
    const json = JSON.stringify(marks);
    const next = previous.then(() => mkdir(this.root, { recursive: true }).then(() => writeFile(this.filePath(repository), json)));
    this.saves.set(repository, next.catch(() => undefined));
    return next;
  }

  private filePath(repository: string): string {
    return join(this.root, `${createHash('sha1').update(repository).digest('hex').slice(0, 16)}.json`);
  }
}

function forgetLeastRecentlyUsed(marks: RepositoryMarks): void {
  const byUse = Object.entries(marks).sort(([, a], [, b]) => b.usedAt - a.usedAt);
  for (const [diff] of byUse.slice(MAX_DIFFS_PER_REPOSITORY)) delete marks[diff];
}
