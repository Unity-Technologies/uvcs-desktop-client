import { useMemo } from 'react';
import type { CodeReview } from '@shared/domain/codeReview';
import { useReviewChangesets } from '../rounds/useReviewChangesets';
import { changesetIdsOf, threadsOf, type ReviewThread } from './reviewThreads';
import { useReviewConversation, type ConversationReading } from './useReviewConversation';

/**
 * A review's comments as threads (`threadsOf`), each read of the conversation once; none while it's read. A question is
 * answered in a changeset of its branch only, once they're read (the one `cm find` its Changes and rounds share).
 */
export function useReviewThreads(review: Pick<CodeReview, 'id' | 'target'>, reading?: ConversationReading): readonly ReviewThread[] | undefined {
  const { data: conversation } = useReviewConversation(review.id, reading);
  const { changesets } = useReviewChangesets(review);
  return useMemo(() => conversation && threadsOf(conversation.comments, changesetIdsOf(changesets)), [conversation, changesets]);
}
