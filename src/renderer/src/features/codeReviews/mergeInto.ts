import type { CodeReviewSummary } from '@shared/domain/codeReview';
import type { Place } from '@shared/domain/place';
import { branchLabel } from '../../lib/branchLabels';
import type { MergeRequestReview } from '../mergeTask/taskMerge';

/** "Merge into main…": the ellipsis as it opens the merge page, where the merge is confirmed. */
export function mergeIntoLabel(destination: string): string {
  return `Merge into ${branchLabel(destination)}…`;
}

/**
 * What the menus' Merge into needs of a review (docs/features/merge-requests.md "Merging"): an Open merge request whose
 * branch is named, in a window with a workspace (the merge page runs in one, so a repository's window doesn't offer it).
 */
export function mergeIntoOf(place: Place, review: CodeReviewSummary): { request: MergeRequestReview; source: string; label: string } | undefined {
  const { mergeRequest, target } = review;
  if (place.kind !== 'workspace' || mergeRequest?.state !== 'Open' || target?.kind !== 'branch') return undefined;
  return { request: { id: review.id, title: review.title, mergeRequest }, source: target.branch, label: mergeIntoLabel(mergeRequest.destination) };
}
