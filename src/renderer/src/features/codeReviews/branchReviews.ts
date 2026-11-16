import type { CodeReviewSummary } from '@shared/domain/codeReview';
import { reviewOfEachBranch } from './reviewsByBranch';

/**
 * What one read of a block of branches' reviews (newest first) answers for each branch asked: the review that stands
 * for it (`reviewOfEachBranch`'s rule), or null when it has none, so that a branch without reviews is known and not
 * asked again.
 */
export function standingReviewsOf(branchIds: readonly number[], reviews: readonly CodeReviewSummary[]): ReadonlyMap<number, CodeReviewSummary | null> {
  const standing = reviewOfEachBranch(reviews);
  return new Map(branchIds.map((branchId) => [branchId, standing.get(branchId) ?? null]));
}
