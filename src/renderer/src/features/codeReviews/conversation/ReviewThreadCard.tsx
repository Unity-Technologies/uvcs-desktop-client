import { ChevronRight } from 'lucide-react';
import { placeId } from '@shared/domain/place';
import type { CodeReview } from '@shared/domain/codeReview';
import { isAuthor } from '../reviewers';
import { commentDraftKey } from '../../../components/DetailsHeading';
import { useState, type ReactNode } from 'react';
import { usePlace } from '../../../app/workspace/useWorkspace';
import { navigation } from '../../../app/navigation/navigationStore';
import { CommentLine } from '../../../components/comments/CommentLine';
import { displayName } from '../../../lib/userName';
import { Avatar } from '../../../ui/Avatar';
import { Button } from '../../../ui/Button';
import { CommentComposer } from './CommentComposer';
import { canDiscard } from './commentPermissions';
import { discardChangeRequest, replyToComment } from './reviewCommentOperations';
import { ReviewCommentView } from './ReviewCommentView';
import type { ReviewThread } from './reviewThreads';
import { commentLocationPage, locationText, replyAction, repliesText, startsFolded, threadBadges, threadKindName, type ThreadBadges } from './threadBadges';
import { openChangesetDiff } from '../../changesets/changesetOperations';
import { ThreadKindIcon } from './ThreadKindIcon';
import styles from './ReviewConversation.module.css';

interface ReviewThreadCardProps {
  review: Pick<CodeReview, 'id' | 'owner'>;
  thread: ReviewThread;
  user: string | undefined;
  /** Shown in the code, under its line or above the code: what it says and offers there (`ThreadInCode`). */
  inCode?: ThreadInCode;
  /** Gone to, the how-many-th time (`ThreadFocus.seq`): unfolded and lit for a moment, so the eye finds it. */
  highlight?: number;
}

/**
 * A thread in the code (the Changes tab) rather than the conversation: its header names no file (it is at it), but
 * says when it was written on an earlier version, and its first comment's menu leads to the conversation and to what
 * changed since.
 */
export interface ThreadInCode {
  /** Written on an earlier version of the file: what the header says of it ("Earlier version"), and its tooltip. */
  earlier?: { label: string; tip: string };
  /** The earlier version's lines it was written on, for one outdated: they're no longer in the code. */
  snippet?: ReactNode;
  showInConversation: () => void;
  changesSince?: () => void;
}

type Answering = 'reply' | 'discard' | null;
type ThreadActions = Pick<ThreadInCode, 'showInConversation' | 'changesSince'>;

/**
 * A comment and its replies as one card. A change request or a question has a header band: its kind's icon, its file
 * and line on a line (a click opens them in Changes), and where it stands as a pill. A settled one starts folded to that line and
 * its first words (`startsFolded`); a click shows it whole.
 */
export function ReviewThreadCard({ review, thread, user, inCode, highlight }: ReviewThreadCardProps) {
  const [folded, setFolded] = useState(() => startsFolded(thread) && highlight === undefined);
  const [shownHighlight, setShownHighlight] = useState(highlight);
  const badges = threadBadges(thread);
  const foldable = startsFolded(thread);
  const hasHeader = thread.root.anchor.kind === 'line' || badges.kind !== undefined;
  // Gone to again: shown whole, as what was asked for.
  if (highlight !== shownHighlight) {
    setShownHighlight(highlight);
    if (highlight !== undefined) setFolded(false);
  }
  const threadActions = inCode && { showInConversation: inCode.showInConversation, changesSince: inCode.changesSince };

  return (
    <section
      className={styles.thread}
      data-folded={folded}
      data-in-code={inCode ? '' : undefined}
      data-highlight={highlight === undefined ? undefined : highlight % 2}
      id={inCode ? undefined : threadElementId(thread.root.id)}
    >
      {hasHeader && <ThreadHeader reviewId={review.id} thread={thread} folded={folded} inCode={inCode} onToggle={foldable ? () => setFolded(!folded) : undefined} />}
      {inCode?.snippet}
      <div className={styles.threadBody}>
        {folded ? <FoldedThread thread={thread} onOpen={() => setFolded(false)} /> : <WholeThread review={review} thread={thread} user={user} threadActions={threadActions} />}
      </div>
    </section>
  );
}

/**
 * A thread as the conversation shows a settled one: its header band, then who started it and their first words; a click
 * anywhere goes to it (the Changes tab's Comments panel, going to it in the code).
 */
export function ThreadSummaryCard({ reviewId, thread, current, onOpen }: { reviewId: number; thread: ReviewThread; current: boolean; onOpen: () => void }) {
  return (
    <section className={styles.thread} data-folded="true" data-current={current || undefined}>
      <ThreadHeader reviewId={reviewId} thread={thread} folded onLocation={{ go: onOpen, tip: 'Show in the code' }} />
      <div className={styles.threadBody}>
        <FoldedThread thread={thread} onOpen={onOpen} />
      </div>
    </section>
  );
}

interface ThreadHeaderProps {
  reviewId: number;
  thread: ReviewThread;
  folded: boolean;
  inCode?: ThreadInCode;
  /** Where its location leads, instead of the review's Changes tab at it (`commentLocationPage`). */
  onLocation?: { go: () => void; tip: string };
  /** Folds or unfolds a settled thread; none for one that stays whole. */
  onToggle?: () => void;
}

function ThreadHeader({ reviewId, thread, folded, inCode, onLocation, onToggle }: ThreadHeaderProps) {
  const { root } = thread;
  const badges = threadBadges(thread);
  // In the code, the thread is at its line: its location would name where the user already is.
  const anchor = root.anchor.kind === 'line' && !inCode ? root.anchor : null;
  const location = anchor && locationText(anchor);
  const replies = folded ? repliesText(thread) : undefined;

  return (
    <div className={styles.threadHeader}>
      {onToggle && (
        <button type="button" className={styles.foldToggle} aria-expanded={!folded} aria-label={folded ? 'Show the thread' : 'Fold the thread'} onClick={onToggle}>
          <ChevronRight size={14} aria-hidden />
        </button>
      )}
      {(badges.kind || inCode) && <ThreadKindIcon root={root} />}
      {anchor && location && (
        <button
          type="button"
          className={styles.location}
          data-tip={onLocation?.tip ?? 'Show in Changes'}
          onClick={() => (onLocation ? onLocation.go() : navigation.openPage(commentLocationPage(reviewId, { ...root, anchor })))}
        >
          <span className={styles.locationFolder}>{location.folder}</span>
          <span className={styles.locationFile}>{location.file}</span>
          <span className={styles.locationLine}>{location.line}</span>
        </button>
      )}
      {inCode && <span className={styles.kindLabel}>{threadKindName(root)}</span>}
      {inCode?.earlier && (
        <span className={styles.earlierTag} data-tip={inCode.earlier.tip}>
          {inCode.earlier.label}
        </span>
      )}
      <span className={styles.headerEnd}>
        {replies && <span className={styles.replyCount}>{replies}</span>}
        {badges.state && (
          <StatePill state={badges.state} appliedIn={badges.appliedIn} />
        )}
      </span>
    </div>
  );
}

/**
 * Where a thread stands, as an outlined pill. "Applied in 281299" is one link as a whole, opening the changeset that
 * applied it: a chip inside the pill would be a frame in a frame.
 */
function StatePill({ state, appliedIn }: { state: NonNullable<ThreadBadges['state']>; appliedIn: number | undefined }) {
  if (appliedIn === undefined) {
    return (
      <span className={styles.pill} data-tone={state.tone}>
        {state.label}
      </span>
    );
  }
  return (
    <button type="button" className={styles.pill} data-tone={state.tone} data-tip={`Open changeset ${appliedIn}`} onClick={() => openChangesetDiff({ id: appliedIn })}>
      {state.label} {appliedIn}
    </button>
  );
}

/** A settled thread folded: who started it and its first words, a click showing it whole. */
function FoldedThread({ thread, onOpen }: { thread: ReviewThread; onOpen: () => void }) {
  const { root } = thread;
  return (
    <button type="button" className={styles.foldedLine} onClick={onOpen}>
      <Avatar user={root.author} size={16} tip={null} />
      <span className={styles.author}>{displayName(root.author)}</span>
      <span className={styles.foldedText}>
        <CommentLine comment={root.text} interactive={false} />
      </span>
    </button>
  );
}

/** Every comment of the thread, then a reply box, and Discard for a change request someone else asked for. */
function WholeThread({ review, thread, user, threadActions }: { review: Pick<CodeReview, 'owner'>; thread: ReviewThread; user: string | undefined; threadActions?: ThreadActions }) {
  const place = usePlace();
  const [answering, setAnswering] = useState<Answering>(null);
  const { root, replies } = thread;

  return (
    <>
      <ReviewCommentView comment={root} thread={thread} user={user} byReviewAuthor={isAuthor(review, root.author)} threadActions={threadActions} />
      {replies.map((reply) => (
        <ReviewCommentView key={reply.id} comment={reply} thread={thread} user={user} action={replyAction(reply)} byReviewAuthor={isAuthor(review, reply.author)} />
      ))}
      <div className={styles.answer}>
        {answering === 'reply' && (
          <CommentComposer
            draftKey={commentDraftKey(placeId(place), 'reviewReply', root.guid)}
            placeholder="Reply"
            label="Reply"
            submitLabel="Reply"
            autoFocus
            onSubmit={async (text) => {
              const sent = await replyToComment(place, root, text);
              if (sent) setAnswering(null);
              return sent;
            }}
            onCancel={() => setAnswering(null)}
          />
        )}
        {answering === 'discard' && (
          <CommentComposer
            draftKey={commentDraftKey(placeId(place), 'reviewDiscard', root.guid)}
            placeholder="Why isn't this change needed?"
            label="Why the change request is discarded"
            submitLabel="Discard change request"
            danger
            autoFocus
            onSubmit={async (text) => {
              const sent = await discardChangeRequest(place, root, text);
              if (sent) setAnswering(null);
              return sent;
            }}
            onCancel={() => setAnswering(null)}
          />
        )}
        {answering === null && (
          <div className={styles.answerButtons}>
            <button type="button" className={styles.replyPrompt} onClick={() => setAnswering('reply')}>
              Reply…
            </button>
            {canDiscard(thread, user) && (
              <Button size="small" variant="ghost" onClick={() => setAnswering('discard')}>
                Discard…
              </Button>
            )}
          </div>
        )}
      </div>
    </>
  );
}

/** The thread's element, which a link to it scrolls to. */
export function threadElementId(commentId: number): string {
  return `review-thread-${commentId}`;
}
