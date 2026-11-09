import { useMemo } from 'react';
import { threadsOf, type ReviewThread } from './reviewThreads';
import { useReviewConversation } from './useReviewConversation';

/** A review's comments as threads (`threadsOf`), each read of the conversation once; none while it's read. */
export function useReviewThreads(reviewId: number): readonly ReviewThread[] | undefined {
  const { data: conversation } = useReviewConversation(reviewId);
  return useMemo(() => conversation && threadsOf(conversation.comments), [conversation]);
}
