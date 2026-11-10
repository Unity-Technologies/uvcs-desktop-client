import type { Place } from '@shared/domain/place';
import { queryKeys } from '../../api/queryKeys';

/**
 * Where one review, as its page reads it, is cached (`useCodeReview`). Apart from the hook, so Refresh reads what the
 * review in front is of without the API client (`refreshShown`).
 */
export function codeReviewKey(place: Place, reviewId: number): readonly unknown[] {
  return queryKeys.inPlace(place, 'codeReviews', 'review', reviewId);
}
