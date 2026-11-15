import { navigation } from '../../app/navigation/navigationStore';
import { conversationAt } from '../../features/codeReviews/inline/reviewComments';

/** Opens a change request's review at its thread, brought into view and lit, as Show in conversation does. */
export function openChangeRequest({ reviewId, threadId }: { reviewId: number; threadId: number }): void {
  navigation.openPage(conversationAt(reviewId, threadId));
}
