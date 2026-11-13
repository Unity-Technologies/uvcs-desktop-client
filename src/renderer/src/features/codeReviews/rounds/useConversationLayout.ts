import { useState } from 'react';
import type { CodeReview } from '@shared/domain/codeReview';
import { useReviewConversation } from '../conversation/useReviewConversation';
import { answerIsCurrent, keptLayoutAfter, type KeptLayout } from './keptLayout';
import type { ConversationLayout } from './reviewRounds';
import { useReviewChangesets } from './useReviewChangesets';

/**
 * The layout the review's conversation keeps while its page is open (`keptLayoutAfter`): taken once, from the reads the
 * page started, so what the user (or a refresh) changes updates the cards in place. None until then. It reads nothing
 * of its own: the page reads the conversation and the changesets anyway, through the same queries.
 */
export function useConversationLayout(review: Pick<CodeReview, 'id' | 'date' | 'target'>, user: string | undefined): ConversationLayout | undefined {
  const conversation = useReviewConversation(review.id);
  const { changesets, current: changesetsRead } = useReviewChangesets(review);
  const [kept, setKept] = useState<KeptLayout>();
  const next = keptLayoutAfter(kept, {
    reviewId: review.id,
    reviewDate: review.date,
    user,
    conversation: conversation.data,
    conversationRead: answerIsCurrent(conversation),
    changesets,
    changesetsRead,
  });
  // Kept from the render it's taken in, as React allows for a component's own state.
  if (next !== kept) setKept(next);
  return next?.layout;
}
