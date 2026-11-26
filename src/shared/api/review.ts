import type { DiffReviewMark, ReviewMark } from '../domain/review';
import type { RepositoryGuid } from '../domain/stableIds';

/** Review marks of a workspace's pending changes, checked against the files on disk. */
export interface ReviewApi {
  marks(workspacePath: string): Promise<ReviewMark[]>;
  /** Marks the files as reviewed as they are now, replacing earlier marks. */
  mark(workspacePath: string, paths: string[]): Promise<void>;
  unmark(workspacePath: string, paths: string[]): Promise<void>;
  /** Forgets the marks of every path not in `pendingPaths`: checked in, undone or gone. */
  keepOnly(workspacePath: string, pendingPaths: string[]): Promise<void>;
  /**
   * Review marks of a committed diff, named like `cs:42` or `br:<branch GUID>`, in a repository (its GUID).
   * `formerDiff`: the name its marks were kept by before (`br:/main/task`), which move under `diff` while it has none.
   */
  diffMarks(repository: RepositoryGuid, diff: string, formerDiff?: string): Promise<DiffReviewMark[]>;
  markDiff(repository: RepositoryGuid, diff: string, marks: DiffReviewMark[]): Promise<void>;
  unmarkDiff(repository: RepositoryGuid, diff: string, paths: string[]): Promise<void>;
}
