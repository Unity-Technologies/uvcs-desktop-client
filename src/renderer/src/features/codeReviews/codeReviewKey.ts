import type { Place } from '@shared/domain/place';
import { queryKeys } from '../../api/queryKeys';

/**
 * Where one review, as its page reads it, is cached (`useCodeReview`). Apart from the hook, so Refresh reads what the
 * review in front is of without the API client (`refreshShown`).
 */
export function codeReviewKey(place: Place, reviewId: number): readonly unknown[] {
  return queryKeys.inPlace(place, 'codeReviews', 'review', reviewId);
}

/**
 * Where the user's email subscription to a review is cached (`useReviewSubscription`): under the reviews' area, by the
 * review's number. Apart from the hook, so the operation that changes it (`setReviewSubscription`) imports no hook.
 */
export function reviewSubscriptionKey(place: Place, reviewId: number): readonly unknown[] {
  return queryKeys.inPlace(place, 'codeReviews', 'subscription', reviewId);
}
