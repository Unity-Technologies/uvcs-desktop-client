import { useEffect, useMemo, useState } from 'react';
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
import { openItemsOf, pickedScrollOf, pickOnFocus, pickThread, threadMarkOf } from './threadPick';
import { isLineThread } from '../inline/fileThreads';
import { useCommentContext } from '../inline/useCommentContext';
import { ReviewerChangesRow } from './ReviewerChangesRow';
import { TimelineEventRow } from './TimelineEventRow';
import { useReviewConversation } from './useReviewConversation';
import styles from './ReviewConversation.module.css';

/**
 * What was said on a review, oldest first as a conversation reads: its description, then the comments and their
 * replies among what the server noted (requests, statuses, renames), then a field to say something. Beside it, the
 * reviewers and what's still open.
 */
interface ReviewConversationTabProps {
  review: CodeReview;
  /** The thread the page was opened at (Show in conversation, from the code): gone to, lit and ringed. */
  focusThread?: number;
  /** A thread picked in Open: the page forgets the one it was opened at, so going to it again goes to it. */
  onPickedInOpen: () => void;
}

export function ReviewConversationTab({ review, focusThread, onPickedInOpen }: ReviewConversationTabProps) {
  const place = usePlace();
  const user = usePlaceUser();
  // "Show in conversation" from the dialog moves this page to the thread, in place (`showInConversation`).
  const seeInContext = useCommentContext(review);
  // "Applied" shows how the change request was applied, in context, as in the code.
  const seeAppliedOf = (thread: ReviewThread): (() => void) | undefined =>
    seeInContext && isLineThread(thread) ? () => seeInContext(thread, { startsOn: 'since' }) : undefined;
  const { data: conversation, isPending, error } = useReviewConversation(review.id);
  const timeline = useMemo(() => (conversation ? foldReviewerChanges(timelineOf(conversation)) : []), [conversation]);
  const open = useMemo(() => (conversation ? openThreads(threadsOf(conversation.comments)) : []), [conversation]);

  // The thread gone to: opened at (Show in conversation, from the code) or picked in Open. Lit, ringed, marked in Open.
  const [pick, setPick] = useState(() => pickOnFocus(undefined, focusThread));
  const [pickedFocus, setPickedFocus] = useState(focusThread);
  if (focusThread !== pickedFocus) {
    setPickedFocus(focusThread);
    setPick(pickOnFocus(pick, focusThread));
  }
  const openItems = useMemo(() => openItemsOf(review.id, open, pick), [review.id, open, pick]);

  // Brought into view once read, after its card unfolds.
  const read = conversation !== undefined;
  useEffect(() => {
    if (read && pick) document.getElementById(threadElementId(pick.threadId))?.scrollIntoView(pickedScrollOf(pick));
  }, [read, pick]);

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
                        {...threadMarkOf(entry.thread.root.id, pick)}
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
        <ReviewSideRail review={review} open={openItems} onPick={(threadId) => {
            setPick((previous) => pickThread(previous, threadId));
            onPickedInOpen();
          }} />
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
