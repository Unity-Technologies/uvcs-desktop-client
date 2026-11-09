import { useCallback, useEffect, useMemo } from 'react';
import { navigation } from '../../../app/navigation/navigationStore';
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
import { ReviewThreadCard, threadElementId } from './ReviewThreadCard';
import { foldReviewerChanges, openThreads, threadsOf, timelineOf, type ReviewThread, type TimelineEntry } from './reviewThreads';
import { isLineThread } from '../inline/fileThreads';
import { useCommentContext } from '../inline/useCommentContext';
import { conversationAt } from '../inline/reviewComments';
import { ReviewerChangesRow } from './ReviewerChangesRow';
import { TimelineEventRow } from './TimelineEventRow';
import { useReviewConversation } from './useReviewConversation';
import styles from './ReviewConversation.module.css';

/**
 * What was said on a review, oldest first as a conversation reads: its description, then the comments and their
 * replies among what the server noted (requests, statuses, renames), then a field to say something. Beside it, the
 * reviewers and what's still open.
 */
export function ReviewConversationTab({ review, focusThread }: { review: CodeReview; focusThread?: number }) {
  const place = usePlace();
  const user = usePlaceUser();
  // Already in the conversation: "Show in conversation" from the dialog scrolls to the thread on this page.
  const showThreadHere = useCallback((threadId: number) => navigation.replacePage(conversationAt(review.id, threadId)), [review.id]);
  const seeInContext = useCommentContext(review, showThreadHere);
  // "Applied" shows how the change request was applied, in context, as in the code.
  const seeAppliedOf = (thread: ReviewThread): (() => void) | undefined =>
    seeInContext && isLineThread(thread) ? () => seeInContext(thread, { startsOn: 'since' }) : undefined;
  const { data: conversation, isPending, error } = useReviewConversation(review.id);
  const timeline = useMemo(() => (conversation ? foldReviewerChanges(timelineOf(conversation)) : []), [conversation]);
  const open = useMemo(() => (conversation ? openThreads(threadsOf(conversation.comments)) : []), [conversation]);

  // Opened on a thread (Show in conversation, from the code): brought into view once read, and lit.
  const read = conversation !== undefined;
  useEffect(() => {
    if (read && focusThread !== undefined) document.getElementById(threadElementId(focusThread))?.scrollIntoView({ block: 'center' });
  }, [read, focusThread]);

  if (error) return <EmptyState title="Couldn't read the conversation" description={error.message} />;

  return (
    // The whole tab scrolls, its scrollbar at the window's edge; the conversation is a column centered in it.
    <div className={styles.scroller}>
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
                {timeline.map((entry) => (
                  <li key={entryKey(entry)}>
                    {entry.kind === 'event' && <TimelineEventRow event={entry.event} />}
                    {entry.kind === 'reviewerChanges' && <ReviewerChangesRow events={entry.events} />}
                    {entry.kind === 'thread' && (
                      <ReviewThreadCard
                        review={review}
                        thread={entry.thread}
                        user={user}
                        highlight={entry.thread.root.id === focusThread ? 1 : undefined}
                        onSeeApplied={seeAppliedOf(entry.thread)}
                      />
                    )}
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
    </div>
  );
}

function entryKey(entry: TimelineEntry): string {
  switch (entry.kind) {
    case 'event':
      return `event-${entry.event.id}`;
    case 'reviewerChanges':
      return `events-${entry.events[0]!.id}`;
    case 'thread':
      return `thread-${entry.thread.root.id}`;
  }
}
