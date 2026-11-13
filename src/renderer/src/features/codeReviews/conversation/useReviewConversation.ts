import { useQuery, type QueryClient } from '@tanstack/react-query';
import type { Place } from '@shared/domain/place';
import { api } from '../../../api/client';
import { queryClient } from '../../../app/queryClient';
import { usePlace } from '../../../app/workspace/useWorkspace';
import { conversationKey } from './conversationKey';

/**
 * Everything said on a review, read with one `cm find`. Under the reviews' area, so whatever changes a review reads it
 * again (`isAffectedByCodeReviews`), and so does a focus once stale: others write on it too.
 */
export function useReviewConversation(reviewId: number, reading: ConversationReading = {}) {
  const place = usePlace();
  return useQuery({ ...conversationQuery(place, reviewId), ...reading });
}

/** How a review's conversation is read: one query per review, which its page and the change requests to apply share. */
export function conversationQuery(place: Place, reviewId: number) {
  return {
    queryKey: conversationKey(place, reviewId),
    queryFn: () => api.reviewComments.conversation(place, reviewId),
  };
}


/** How a view reads the conversation, when it isn't the page's own way. */
export type ConversationReading = { refetchOnMount?: false };

/**
 * For what opens over the review's page (the comment's context dialog): the page shows the same conversation, kept
 * fresh by it (a write, a focus once stale), so opening it reads nothing, however long the page has been shown.
 */
export const SHOWN_BY_THE_PAGE: ConversationReading = { refetchOnMount: false };


/**
 * When the conversation was last read (or its read failed), 0 if it never was: taken right after a write, what
 * `conversationReadSince` waits to be passed. After the write, not before: a read finishing while it ran may not hold
 * what it wrote, and the write asks for a new one (`isAffectedByCodeReviews`) as it ends.
 */
export function conversationReadAt(place: Place, reviewId: number, client: QueryClient = queryClient): number {
  const state = client.getQueryState(conversationKey(place, reviewId));
  return state ? Math.max(state.dataUpdatedAt, state.errorUpdatedAt) : 0;
}

/**
 * Resolves once the conversation on screen was read again after `since` (`conversationReadAt`), or its read failed: a
 * comment just written shows then, so the field that wrote it stays until it does. It reads nothing itself: the write
 * already asked for the read, and a second would cost the server a second `cm find`. At once when nothing shows the
 * conversation, as then nothing reads it.
 */
export function conversationReadSince(place: Place, reviewId: number, since: number, client: QueryClient = queryClient): Promise<void> {
  const queryKey = conversationKey(place, reviewId);
  const readSince = (): boolean => {
    const query = client.getQueryCache().find({ queryKey, exact: true });
    if (!query || query.getObserversCount() === 0) return true;
    return Math.max(query.state.dataUpdatedAt, query.state.errorUpdatedAt) > since;
  };
  return new Promise((resolve) => {
    if (readSince()) return resolve();
    const unsubscribe = client.getQueryCache().subscribe(() => {
      if (!readSince()) return;
      unsubscribe();
      resolve();
    });
  });
}
