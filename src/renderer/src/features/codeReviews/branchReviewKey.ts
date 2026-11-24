import type { Place } from '@shared/domain/place';
import { queryKeys } from '../../api/queryKeys';

/** The key part naming the review that stands for one branch: one review or null, not a list. */
export const BRANCH_REVIEW_KEY = 'ofBranch';

/** The query of the review that stands for one branch (`branchReviewQuery`), under the reviews' area. */
export function branchReviewKey(place: Place, branchId: number): readonly unknown[] {
  return queryKeys.inPlace(place, 'codeReviews', BRANCH_REVIEW_KEY, branchId);
}
