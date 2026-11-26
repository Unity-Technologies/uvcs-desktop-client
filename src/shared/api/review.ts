import type { Place } from '../domain/place';
import type { DiffReviewMark, ReviewMark } from '../domain/review';
import type { AppSettings } from '../domain/settings';
import type { RepositoryGuid } from '../domain/stableIds';

/** Review marks of a workspace's pending changes, checked against the files on disk. */
export interface ReviewApi {
  /**
   * What review mode is kept by for the place in `reviewModeWorkspaces`: its workspace's GUID (a local read) or its
   * repository's (from the server's listing, which the home screen and the repository's settings read too), which a
   * rename or a move keeps; its `placeId` when `cm` can't tell one. What was kept by its path or spec moves to it.
   */
  reviewModeKey(place: Place): Promise<string>;
  /**
   * Turns review mode on or off for the place, by its key (`reviewModeKey`), changing the stored list in one write.
   * Turning it on is taking the offer, so the hint never shows again. Resolves to the settings saved and the key used,
   * which a window that kept another (its `placeId`, while no GUID could be told) follows.
   */
  setReviewMode(place: Place, on: boolean): Promise<{ settings: AppSettings; key: string }>;
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
  markDiff(repository: RepositoryGuid, diff: string, marks: DiffReviewMark[], formerDiff?: string): Promise<void>;
  unmarkDiff(repository: RepositoryGuid, diff: string, paths: string[], formerDiff?: string): Promise<void>;
}
