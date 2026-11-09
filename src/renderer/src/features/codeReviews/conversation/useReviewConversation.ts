import { useQuery } from '@tanstack/react-query';
import { api } from '../../../api/client';
import { queryKeys } from '../../../api/queryKeys';
import { usePlace } from '../../../app/workspace/useWorkspace';

/**
 * Everything said on a review, read with one `cm find`. Under the reviews' area, so whatever changes a review reads it
 * again (`isAffectedByCodeReviews`), and so does a focus once stale: others write on it too.
 */
export function useReviewConversation(reviewId: number, reading: ConversationReading = {}) {
  const place = usePlace();
  return useQuery({
    queryKey: queryKeys.inPlace(place, 'codeReviews', 'conversation', reviewId),
    queryFn: () => api.reviewComments.conversation(place, reviewId),
    ...reading,
  });
}

/** How a view reads the conversation, when it isn't the page's own way. */
export type ConversationReading = { refetchOnMount?: false };

/**
 * For what opens over the review's page (the comment's context dialog): the page shows the same conversation, kept
 * fresh by it (a write, a focus once stale), so opening it reads nothing, however long the page has been shown.
 */
export const SHOWN_BY_THE_PAGE: ConversationReading = { refetchOnMount: false };
