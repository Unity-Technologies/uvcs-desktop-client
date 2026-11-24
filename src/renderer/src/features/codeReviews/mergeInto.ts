import type { CodeReviewSummary } from '@shared/domain/codeReview';
import type { Place } from '@shared/domain/place';
import { branchLabel } from '../../lib/branchLabels';
import type { MergeRequestToMerge } from '../mergeTask/taskMerge';

/** A merge request's merge, as Merge into opens it (`openMergeRequestMerge`): the request, its branch, the words. */
export interface MergeInto {
  request: MergeRequestToMerge;
  source: string;
  /** "Merge into main…": the ellipsis as it opens the merge page, where the merge is confirmed. */
  label: string;
}

/**
 * Whether a review can be merged into its destination, the one rule the card and the menus follow
 * (docs/features/merge-requests.md "Merging"): an Open merge request whose branch is named.
 */
export function mergeOfRequest(review: Pick<CodeReviewSummary, 'id' | 'title' | 'mergeRequest' | 'target'>): MergeInto | undefined {
  const { mergeRequest, target } = review;
  if (mergeRequest?.state !== 'Open' || target?.kind !== 'branch') return undefined;
  return { request: { id: review.id, title: review.title, mergeRequest }, source: target.branch, label: `Merge into ${branchLabel(mergeRequest.destination)}…` };
}

/**
 * The menus' Merge into: `mergeOfRequest`, only in a window with a workspace (the merge page runs in one), so a
 * repository's window doesn't offer it. The card shows it disabled there instead.
 */
export function mergeIntoOf(place: Place, review: CodeReviewSummary): MergeInto | undefined {
  return place.kind === 'workspace' ? mergeOfRequest(review) : undefined;
}
