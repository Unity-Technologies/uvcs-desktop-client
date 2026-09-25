import type { CodeReview, CodeReviewStatus } from '@shared/domain/codeReview';

/** Short status names for chips next to a branch name. */
export const SHORT_STATUS: Record<CodeReviewStatus, string> = {
  'Under review': 'In review',
  Reviewed: 'Reviewed',
  'Rework required': 'Rework',
};

/** The newest review of each branch, from reviews listed newest first. */
export function latestReviewByBranch(reviews: readonly CodeReview[]): ReadonlyMap<string, CodeReview> {
  const byBranch = new Map<string, CodeReview>();
  for (const review of reviews) {
    if (review.target.kind === 'branch' && !byBranch.has(review.target.branch)) byBranch.set(review.target.branch, review);
  }
  return byBranch;
}
