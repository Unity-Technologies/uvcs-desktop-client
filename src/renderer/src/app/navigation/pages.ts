import type { DiffTarget } from '@shared/domain/diff';
import type { MergeRequest } from '@shared/domain/merge';
import type { RevisionRef } from '@shared/domain/revision';
import type { TaskMerge } from '../../features/mergeTask/taskMerge';

/**
 * A page is a drill-down opened on top of the current view (history of a file, a diff, a merge...).
 * Pages stack, so users can go back to where they came from.
 */
export type Page =
  /**
   * `revision` reads the history of the item it is a revision of (browsing a changeset, a diff), instead of the
   * workspace's file at `path`, which may have moved or be missing. `select` opens on that revision; `view: 'annotate'`
   * shows it annotated (at the workspace's revision unless `select` says otherwise): what every "Annotate" outside the
   * Files view opens.
   */
  | { kind: 'history'; path: string; revision?: RevisionRef; select?: HistorySelection; view?: 'annotate' }
  /**
   * `focusPath` preselects a file in the diff. `branchHead`, for a branch, is the head it was seen at: the diff is
   * then the one a details panel may already have read, not a second `cm diff`.
   */
  | { kind: 'diff'; title: string; target: DiffTarget; focusPath?: string; branchHead?: number }
  /** `task`: a task branch merged into a branch on the server, which the page also offers to finish (`TaskMerge`). */
  | { kind: 'merge'; request: MergeRequest; task?: TaskMerge }
  | { kind: 'codeReview'; reviewId: number; focusPath?: string }
  | { kind: 'browseRepository'; changesetId: number };

/** A revision of a history: the one a changeset made, or one by its id (which finds it wherever the file was then). */
type HistorySelection = { changesetId: number } | { revisionId: number };

type PageKind = Page['kind'];

export type PageOf<Kind extends PageKind> = Extract<Page, { kind: Kind }>;

export interface PageProps<Kind extends PageKind> {
  page: PageOf<Kind>;
}
