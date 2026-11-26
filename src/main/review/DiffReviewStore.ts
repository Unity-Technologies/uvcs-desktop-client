import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { DiffReviewMark } from '@shared/domain/review';
import type { RepositoryGuid } from '@shared/domain/stableIds';
import { PersistedByKey } from './PersistedByKey';

/** Diffs remembered per repository; the least recently used go first. */
const MAX_DIFFS_PER_REPOSITORY = 200;

interface StoredDiff {
  usedAt: number;
  /** Path → the revision reviewed. */
  marks: Record<string, number>;
}

type RepositoryMarks = Record<string, StoredDiff>;

/**
 * Review marks of committed diffs (a changeset, a branch, a shelve...), per repository in `<root>/<repository GUID>.json`,
 * which a rename keeps (ARCHITECTURE.md "Settings survive renames"). History doesn't change, so a mark is the revision
 * reviewed: a file is changed since its review when the diff now shows another revision of it, e.g. after new
 * changesets on a branch.
 */
export class DiffReviewStore {
  private readonly files = new PersistedByKey<RepositoryMarks, RepositoryGuid>((repository) =>
    readFile(this.filePath(repository), 'utf8')
      .then((json) => JSON.parse(json) as RepositoryMarks)
      .catch(() => ({})),
  );

  constructor(
    private readonly root: string,
    private readonly now: () => number = Date.now,
    /** How many diffs each repository remembers; tests pass a few, as remembering each is a write of its file. */
    private readonly maxDiffsPerRepository = MAX_DIFFS_PER_REPOSITORY,
  ) {}

  /**
   * The diff's marks. `formerDiff`, here and in `mark` and `unmark`: the name they were kept by before (a branch's diff
   * by the branch's name, now by its GUID), whose marks move under `diff` while it keeps none, whichever comes first.
   */
  async marks(repository: RepositoryGuid, diff: string, formerDiff?: string): Promise<DiffReviewMark[]> {
    const repositoryMarks = await this.files.load(repository);
    if (movedFromFormerName(repositoryMarks, diff, formerDiff)) await this.save(repository, repositoryMarks);
    return Object.entries(repositoryMarks[diff]?.marks ?? {}).map(([path, revisionId]) => ({ path, revisionId }));
  }

  /**
   * The file of marks kept by the repository's spec, before they were kept by its GUID, becomes the GUID's, once it is
   * known: unless the GUID has one of its own, or it was read already this session.
   */
  async keepRepositoryByGuid(spec: string, guid: RepositoryGuid): Promise<void> {
    if (this.files.has(guid) || (await exists(this.filePath(guid)))) return;
    await rename(this.filePathBySpec(spec), this.filePath(guid)).catch(() => undefined);
  }

  async mark(repository: RepositoryGuid, diff: string, marks: DiffReviewMark[], formerDiff?: string): Promise<void> {
    await this.update(repository, diff, formerDiff, (current) => ({ ...current, ...Object.fromEntries(marks.map((mark) => [mark.path, mark.revisionId])) }));
  }

  async unmark(repository: RepositoryGuid, diff: string, paths: string[], formerDiff?: string): Promise<void> {
    const unmarked = new Set(paths);
    await this.update(repository, diff, formerDiff, (current) => Object.fromEntries(Object.entries(current).filter(([path]) => !unmarked.has(path))));
  }

  private async update(repository: RepositoryGuid, diff: string, formerDiff: string | undefined, change: (marks: Record<string, number>) => Record<string, number>): Promise<void> {
    const repositoryMarks = await this.files.load(repository);
    movedFromFormerName(repositoryMarks, diff, formerDiff);
    const marks = change(repositoryMarks[diff]?.marks ?? {});
    if (Object.keys(marks).length === 0) delete repositoryMarks[diff];
    else repositoryMarks[diff] = { usedAt: this.now(), marks };
    forgetLeastRecentlyUsed(repositoryMarks, this.maxDiffsPerRepository);
    await this.save(repository, repositoryMarks);
  }

  private save(repository: RepositoryGuid, marks: RepositoryMarks): Promise<void> {
    const json = JSON.stringify(marks);
    return this.files.save(repository, async () => {
      await mkdir(this.root, { recursive: true });
      await writeFile(this.filePath(repository), json);
    });
  }

  private filePath(repository: RepositoryGuid): string {
    return join(this.root, `${repository}.json`);
  }

  /** Where the repository's marks were kept before they were kept by its GUID: by a hash of its spec as written. */
  private filePathBySpec(spec: string): string {
    return join(this.root, `${createHash('sha1').update(spec).digest('hex').slice(0, 16)}.json`);
  }
}

async function exists(path: string): Promise<boolean> {
  return stat(path).then(
    () => true,
    () => false,
  );
}

/** Moves the marks kept under `formerDiff` to `diff` while it keeps none; whether it did. */
function movedFromFormerName(marks: RepositoryMarks, diff: string, formerDiff: string | undefined): boolean {
  if (formerDiff === undefined || marks[diff] || !marks[formerDiff]) return false;
  marks[diff] = marks[formerDiff];
  delete marks[formerDiff];
  return true;
}

function forgetLeastRecentlyUsed(marks: RepositoryMarks, kept: number): void {
  const byUse = Object.entries(marks).sort(([, a], [, b]) => b.usedAt - a.usedAt);
  for (const [diff] of byUse.slice(kept)) delete marks[diff];
}
