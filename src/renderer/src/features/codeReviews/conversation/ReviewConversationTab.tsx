import { useMemo } from 'react';
import { placeId } from '@shared/domain/place';
import { commentDraftKey } from '../../../components/DetailsHeading';
import type { CodeReview } from '@shared/domain/codeReview';
import { usePlaceUser } from '../../../app/account/accounts';
import { usePlace } from '../../../app/workspace/useWorkspace';
import { EmptyState } from '../../../ui/EmptyState';
import { SkeletonBar } from '../../../ui/Skeleton';
import { CommentComposer } from './CommentComposer';
import { addReviewComment } from './reviewCommentOperations';
import { ReviewDescriptionCard } from './ReviewDescriptionCard';
import { ReviewSideRail } from './ReviewSideRail';
import { ReviewThreadCard } from './ReviewThreadCard';
import { openThreads, threadsOf, timelineOf } from './reviewThreads';
import { TimelineEventRow } from './TimelineEventRow';
import { useReviewConversation } from './useReviewConversation';
import styles from './ReviewConversation.module.css';

/**
 * What was said on a review, oldest first as a conversation reads: its description, then the comments and their
 * replies among what the server noted (requests, statuses, renames), then a field to say something. Beside it, the
 * reviewers and what's still open.
 */
export function ReviewConversationTab({ review }: { review: CodeReview }) {
  const place = usePlace();
  const user = usePlaceUser();
  const { data: conversation, isPending, error } = useReviewConversation(review.id);
  const timeline = useMemo(() => (conversation ? timelineOf(conversation) : []), [conversation]);
  const open = useMemo(() => (conversation ? openThreads(threadsOf(conversation.comments)) : []), [conversation]);

  if (error) return <EmptyState title="Couldn't read the conversation" description={error.message} />;

  return (
    <div className={styles.conversation}>
      <div className={styles.main}>
        {isPending ? (
          <div className={styles.loading} aria-busy="true" aria-label="Loading">
            <SkeletonBar width="60%" />
            <SkeletonBar width="85%" />
            <SkeletonBar width="40%" />
          </div>
        ) : (
          <>
            <ReviewDescriptionCard review={review} description={conversation.description} />
            <ol className={styles.timeline}>
              {timeline.map((item) => (
                <li key={item.kind === 'event' ? `event-${item.event.id}` : `thread-${item.thread.root.id}`}>
                  {item.kind === 'event' ? <TimelineEventRow event={item.event} /> : <ReviewThreadCard reviewId={review.id} thread={item.thread} user={user} />}
                </li>
              ))}
            </ol>
          </>
        )}
        <div className={styles.newComment}>
          <CommentComposer
            draftKey={commentDraftKey(placeId(place), 'reviewComment', review.id)}
            placeholder="Leave a comment"
            label="New comment"
            submitLabel="Comment"
            onSubmit={(text) => addReviewComment(place, review.id, text)}
          />
        </div>
      </div>
      <ReviewSideRail review={review} open={open} />
    </div>
  );
}
