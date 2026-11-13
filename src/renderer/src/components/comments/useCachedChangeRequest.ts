import { partialMatchKey, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useSyncExternalStore } from 'react';
import type { ReviewConversation } from '@shared/domain/reviewConversation';
import { usePlace } from '../../app/workspace/useWorkspace';
import { changeRequestNamed, changeRequestsOf, type ReviewChangeRequest } from '../../features/codeReviews/changeRequests/changeRequests';
import { conversationsKey } from '../../features/codeReviews/conversation/conversationKey';

/**
 * The change request a comment names (`[apply-change:c0d1ce00]`) among the review conversations the window already
 * read: a branch's to apply, a review's page. It never asks the server for anything (docs/features/rich-comments.md,
 * "What a chip reads"), and wakes only as a conversation is read.
 */
export function useCachedChangeRequest(guid: string): ReviewChangeRequest | undefined {
  const place = usePlace();
  const queryClient = useQueryClient();
  const areaKey = useMemo(() => conversationsKey(place), [place]);
  const read = useCallback(() => {
    const reviews = queryClient
      .getQueryCache()
      .findAll({ queryKey: areaKey })
      .flatMap((query) => {
        const reviewId = query.queryKey[areaKey.length];
        const conversation = query.state.data as ReviewConversation | undefined;
        return typeof reviewId === 'number' && conversation ? [changeRequestsOf(reviewId, conversation)] : [];
      });
    return changeRequestNamed(reviews, guid);
  }, [areaKey, queryClient, guid]);
  const subscribe = useCallback(
    (changed: () => void) =>
      queryClient.getQueryCache().subscribe((event) => {
        if ((event.type === 'updated' || event.type === 'removed') && partialMatchKey(event.query.queryKey, areaKey)) changed();
      }),
    [areaKey, queryClient],
  );
  return useSyncExternalStore(subscribe, read);
}
