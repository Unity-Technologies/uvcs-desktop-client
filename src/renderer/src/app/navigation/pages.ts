import type { DiffTarget } from '@shared/domain/diff';
import type { MergeRequest } from '@shared/domain/merge';

/**
 * A page is a drill-down opened on top of the current view (history of a file, a diff, a merge...).
 * Pages stack, so users can go back to where they came from.
 */
export type Page =
  | { kind: 'history'; path: string }
  | { kind: 'annotate'; path: string; revisionSpec?: string }
  /**
   * `focusPath` preselects a file in the diff. `branchHead`, for a branch, is the head it was seen at: the diff is
   * then the one a details panel may already have read, not a second `cm diff`.
   */
  | { kind: 'diff'; title: string; target: DiffTarget; focusPath?: string; branchHead?: number }
  | { kind: 'merge'; request: MergeRequest }
  | { kind: 'codeReview'; reviewId: number; focusPath?: string }
  | { kind: 'browseRepository'; changesetId: number };

export type PageKind = Page['kind'];

export type PageOf<Kind extends PageKind> = Extract<Page, { kind: Kind }>;

export interface PageProps<Kind extends PageKind> {
  page: PageOf<Kind>;
}
