import { useMemo } from 'react';
import type { Changeset } from '@shared/domain/changeset';
import type { CodeReview } from '@shared/domain/codeReview';
import { usePlaceUser } from '../../../app/account/accounts';
import { useReviewConversation } from '../conversation/useReviewConversation';
import { threadsOf } from '../conversation/reviewThreads';
import { checkpointOf, newThreadIds, type ReviewCheckpoint } from './reviewRounds';
import { useReviewChangesets } from './useReviewChangesets';

/** Where the signed-in user left off on a review, and what's new to them since: from what the page reads anyway. */
export interface ReviewCheckpointState {
  /** None before they closed a round, or while what decides it is read. */
  checkpoint: ReviewCheckpoint | undefined;
  /** The threads new to them since (`newThreadIds`); none without a checkpoint. */
  newIds: ReadonlySet<number> | undefined;
  /** The branch's changesets, newest first; none for a review of a changeset or a shelve. */
  changesets: readonly Changeset[] | undefined;
  /** Once what decides the checkpoint is read (or failed): before it, none doesn't yet mean there is none. */
  settled: boolean;
}

export function useReviewCheckpoint(review: CodeReview): ReviewCheckpointState {
  const user = usePlaceUser();
  const { data: conversation, isPending } = useReviewConversation(review.id);
  const { changesets, settled } = useReviewChangesets(review);
  return useMemo(() => {
    // Placed against changesets still being read, the checkpoint would name none and every changeset would look new.
    const checkpoint = conversation && settled ? checkpointOf(conversation.events, user, changesets) : undefined;
    const newIds = checkpoint && conversation ? newThreadIds(threadsOf(conversation.comments), checkpoint, user, changesets) : undefined;
    return { checkpoint, newIds, changesets, settled: settled && !isPending };
  }, [conversation, isPending, settled, user, changesets]);
}
