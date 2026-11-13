import type { Place } from '@shared/domain/place';
import { queryKeys } from '../../../api/queryKeys';

/**
 * Where every review's conversation is cached in a place, its review's number the key's last part. Apart from the
 * hook, so a change request's chip finds the conversations read without the API client (`useCachedChangeRequest`).
 */
export function conversationsKey(place: Place): readonly unknown[] {
  return queryKeys.inPlace(place, 'codeReviews', 'conversation');
}

/** Where one review's conversation is cached (`useReviewConversation`, `conversationQuery`). */
export function conversationKey(place: Place, reviewId: number): readonly unknown[] {
  return [...conversationsKey(place), reviewId];
}
