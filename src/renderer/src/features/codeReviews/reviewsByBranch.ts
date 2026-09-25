import type { CodeReviewStatus, CodeReviewSummary } from '@shared/domain/codeReview';

/** Short status names for chips next to a branch name. */
export const SHORT_STATUS: Record<CodeReviewStatus, string> = {
  'Under review': 'In review',
  Reviewed: 'Reviewed',
  'Rework required': 'Rework',
};

/** The newest review of each branch, by branch object id, from reviews listed newest first. */
export function latestReviewByBranch(reviews: readonly CodeReviewSummary[]): ReadonlyMap<number, CodeReviewSummary> {
  const byBranch = new Map<number, CodeReviewSummary>();
  for (const review of reviews) {
    if (review.targetBranchId !== undefined && !byBranch.has(review.targetBranchId)) byBranch.set(review.targetBranchId, review);
  }
  return byBranch;
}
