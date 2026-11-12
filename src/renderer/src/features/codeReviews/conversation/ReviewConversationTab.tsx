import { Fragment, useEffect, useMemo, useState } from 'react';
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
import { openThreads, threadsOf, type ReviewThread } from './reviewThreads';
import { openItemsOf, pickedScrollOf, pickOnFocus, pickThread, threadMarkOf } from './threadPick';
import { isLineThread } from '../inline/fileThreads';
import { useCommentContext } from '../inline/useCommentContext';
import { ReviewerChangesRow } from './ReviewerChangesRow';
import { TimelineEventRow } from './TimelineEventRow';
import { useReviewConversation } from './useReviewConversation';
import { navigation } from '../../../app/navigation/navigationStore';
import { CheckinsRow } from '../rounds/CheckinsRow';
import { RoundMarker } from '../rounds/RoundMarker';
import { conversationBlocksOf, roundHolding, type ConversationBlock, type ConversationEntry } from '../rounds/reviewRounds';
import { opensAtSince, roundIsOpen, toggledRound } from '../rounds/roundFolds';
import { SinceLine } from '../rounds/SinceLine';
import { newChangesetsSpan } from '../../diff/branchChangesetRows';
import { useReviewCheckpoint } from '../rounds/useReviewCheckpoint';
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
  // A branch's changesets place its check-ins and say where each reviewer left off (`conversationBlocksOf`).
  const { changesets, checkpoint, settled: changesetsSettled } = useReviewCheckpoint(review);
  // "See the changes": what was checked in since the user's last review, selected together in Changes as one diff.
  const newSpan = newChangesetsSpan(changesets, checkpoint);
  const blocks = useMemo(
    () => (conversation ? conversationBlocksOf({ conversation, user, changesets, reviewDate: review.date }) : []),
    [conversation, user, changesets, review.date],
  );
  const [toggledRounds, setToggledRounds] = useState<ReadonlySet<number>>(() => new Set());
  const open = useMemo(() => (conversation ? openThreads(threadsOf(conversation.comments)) : []), [conversation]);

  // The thread gone to: opened at (Show in conversation, from the code) or picked in Open. Lit, ringed, marked in Open.
  const [pick, setPick] = useState(() => pickOnFocus(undefined, focusThread));
  const [pickedFocus, setPickedFocus] = useState(focusThread);
  if (focusThread !== pickedFocus) {
    setPickedFocus(focusThread);
    setPick(pickOnFocus(pick, focusThread));
  }
  const openItems = useMemo(() => openItemsOf(review.id, open, pick), [review.id, open, pick]);

  const pickedRound = pick && roundHolding(blocks, pick.threadId);

  // Brought into view once read, after its card unfolds.
  const read = conversation !== undefined;
  useEffect(() => {
    if (read && pick) document.getElementById(threadElementId(pick.threadId))?.scrollIntoView(pickedScrollOf(pick));
  }, [read, pick]);

  // Opened where the reviewer left off, once: their own status set meanwhile moves the line, never the page.
  const placed = read && changesetsSettled;
  const [openedAtSince, setOpenedAtSince] = useState(false);
  useEffect(() => {
    if (!placed || openedAtSince) return;
    setOpenedAtSince(true);
    if (opensAtSince(blocks, focusThread)) document.getElementById(SINCE_LINE_ID)?.scrollIntoView({ block: 'start', behavior: 'auto' });
  }, [placed, openedAtSince, blocks, focusThread]);

  const renderEntry = (entry: ConversationEntry) => (
    <li key={entryKey(entry)}>
      {entry.kind === 'event' && <TimelineEventRow event={entry.event} />}
      {entry.kind === 'reviewerChanges' && <ReviewerChangesRow events={entry.events} />}
      {entry.kind === 'checkins' && (
        <CheckinsRow entry={entry} onOpenChangeset={(changesetId) => navigation.openPage({ kind: 'codeReview', reviewId: review.id, tab: 'changes', focusChangeset: changesetId })} />
      )}
      {entry.kind === 'thread' && (
        <ReviewThreadCard review={review} thread={entry.thread} user={user} {...threadMarkOf(entry.thread.root.id, pick)} onSeeApplied={seeAppliedOf(entry.thread)} />
      )}
    </li>
  );
  const renderBlock = (block: ConversationBlock) => {
    switch (block.kind) {
      case 'round': {
        // The marker, then what the round held while unfolded, at the timeline's own indent. One keyed fragment per
        // round: a round inserted as a status is given keeps the others' entries mounted (an open "N more" stays open).
        const open = roundIsOpen(block.round, toggledRounds, pickedRound);
        return (
          <Fragment key={`round-${block.round.number}`}>
            <li>
              <RoundMarker round={block.round} user={user} open={open} onToggle={() => setToggledRounds((toggled) => toggledRound(toggled, block.round.number))} />
            </li>
            {open && block.entries.map(renderEntry)}
          </Fragment>
        );
      }
      case 'since':
        return (
          <li key="since">
            <SinceLine
              id={SINCE_LINE_ID}
              date={block.date}
              onSeeChanges={newSpan && (() => navigation.openPage({ kind: 'codeReview', reviewId: review.id, tab: 'changes', focusChangesets: newSpan }))}
            />
          </li>
        );
      case 'entry':
        return renderEntry(block.entry);
    }
  };

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
              <ol className={styles.timeline}>{blocks.map(renderBlock)}</ol>
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

/** The "New since your last review" line's element, which the conversation opens scrolled to. */
const SINCE_LINE_ID = 'review-since-last-review';

function entryKey(entry: ConversationEntry): string {
  switch (entry.kind) {
    case 'event':
      return `event-${entry.event.id}`;
    case 'reviewerChanges':
      return `events-${entry.events[0]!.id}`;
    case 'thread':
      return `thread-${entry.thread.root.id}`;
    case 'checkins':
      return `checkins-${entry.changesets[0]!.id}`;
  }
}
