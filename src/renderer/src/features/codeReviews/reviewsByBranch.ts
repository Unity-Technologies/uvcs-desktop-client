import type { CodeReviewStatus, CodeReviewSummary } from '@shared/domain/codeReview';
import { isActiveMergeRequest } from './mergeRequestState';

/** Short status names for chips next to a branch name. */
export const SHORT_STATUS: Record<CodeReviewStatus, string> = {
  'Under review': 'In review',
  Reviewed: 'Reviewed',
  'Rework required': 'Rework',
};

/**
 * The review that stands for each branch, by branch object id, from reviews listed newest first: a merge request
 * still to merge (Open or Draft) over any newer review, else the newest. Every surface that shows one review of a
 * branch goes by it (the Branches view's and the Branch Explorer's chips, finishing a task).
 */
export function reviewOfEachBranch(reviews: readonly CodeReviewSummary[]): ReadonlyMap<number, CodeReviewSummary> {
  const byBranch = new Map<number, CodeReviewSummary>();
  for (const review of reviews) {
    if (review.targetBranchId === undefined) continue;
    const standing = byBranch.get(review.targetBranchId);
    if (!standing || (isActiveMergeRequest(review) && !isActiveMergeRequest(standing))) byBranch.set(review.targetBranchId, review);
  }
  return byBranch;
}

/** The review that stands for one branch, from that branch's reviews listed newest first (`reviewOfEachBranch`'s rule). */
export function reviewStandingFor(reviewsOfBranch: readonly CodeReviewSummary[]): CodeReviewSummary | undefined {
  return reviewOfEachBranch(reviewsOfBranch).values().next().value;
}
