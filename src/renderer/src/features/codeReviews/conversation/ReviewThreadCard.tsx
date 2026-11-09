import { ChevronRight, X } from 'lucide-react';
import { placeId } from '@shared/domain/place';
import type { CodeReview } from '@shared/domain/codeReview';
import { isAuthor } from '../reviewers';
import { commentDraftKey } from '../../../components/DetailsHeading';
import { useState, type MouseEvent, type ReactNode } from 'react';
import { usePlace } from '../../../app/workspace/useWorkspace';
import { navigation } from '../../../app/navigation/navigationStore';
import { CommentLine } from '../../../components/comments/CommentLine';
import { displayName } from '../../../lib/userName';
import { Avatar } from '../../../ui/Avatar';
import { Button } from '../../../ui/Button';
import { Highlight } from '../../../ui/Highlight';
import { IconButton } from '../../../ui/IconButton';
import { CommentComposer } from './CommentComposer';
import { canDiscard } from './commentPermissions';
import { discardChangeRequest, replyToComment } from './reviewCommentOperations';
import { ReviewCommentView } from './ReviewCommentView';
import type { ReviewThread } from './reviewThreads';
import { commentLocationPage, locationText, writtenLineText, replyAction, repliesText, startsFolded, threadBadges, threadKindName, type ThreadBadges } from './threadBadges';
import { openChangesetDiff } from '../../changesets/changesetOperations';
import { ThreadKindIcon } from './ThreadKindIcon';
import { ROW_FOCUS_ATTRIBUTE } from '../../diff/viewer/diffAnnotations';
import styles from './ReviewConversation.module.css';

interface ReviewThreadCardProps {
  review: Pick<CodeReview, 'id' | 'owner'>;
  thread: ReviewThread;
  user: string | undefined;
  /** Shown in the code, under its line or above the code: what it says and offers there (`ThreadInCode`). */
  inCode?: ThreadInCode;
  /** Gone to, the how-many-th time (`ThreadFocus.seq`): unfolded and lit for a moment, so the eye finds it. */
  highlight?: number;
  /** What "Applied in" opens: how the change request was applied, in context; else the changeset that applied it. */
  onSeeApplied?: () => void;
}

/**
 * A thread in the code (the Changes tab) rather than the conversation: its header names no file (it is at it), but
 * says when it was written on an earlier version, a tag that shows it as it was written; its first comment's menu leads
 * to the conversation.
 */
export interface ThreadInCode {
  /** Written on an earlier version of the file: what the header says of it ("Earlier version"), and its tooltip. */
  earlier?: { label: string; tip: string };
  /** The earlier version's lines it was written on, for one outdated: they're no longer in the code. */
  snippet?: ReactNode;
  showInConversation: () => void;
  /**
   * What the "Earlier version" or "Outdated" tag opens: the diff it was written on, and what was done since
   * (`openCommentContextDialog`, on "When commented"), as "Applied in" opens it on how it was applied.
   */
  seeInContext?: () => void;
  /**
   * Folds it back into its line's marker, opened from it (or gone to) while comments are hidden: an × at the header's
   * end, so the card keeps its width; none while comments show in the code.
   */
  hide?: { label: string; onHide: () => void };
}

type Answering = 'reply' | 'discard' | null;
type ThreadActions = Pick<ThreadInCode, 'showInConversation'>;

/**
 * A comment and its replies as one card. A change request or a question has a header band: its kind's icon, its file
 * and line on a line (a click opens them in Changes), and where it stands as a pill. A settled one starts folded to that line and
 * its first words (`startsFolded`); a click shows it whole.
 */
export function ReviewThreadCard({ review, thread, user, inCode, highlight, onSeeApplied }: ReviewThreadCardProps) {
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
  const threadActions = inCode && { showInConversation: inCode.showInConversation };

  return (
    <section
      className={styles.thread}
      data-folded={folded}
      data-in-code={inCode ? '' : undefined}
      data-highlight={highlight === undefined ? undefined : highlight % 2}
      {...(inCode && highlight !== undefined && { [ROW_FOCUS_ATTRIBUTE]: '' })}
      id={inCode ? undefined : threadElementId(thread.root.id)}
    >
      {hasHeader && <ThreadHeader reviewId={review.id} thread={thread} folded={folded} inCode={inCode} onSeeApplied={onSeeApplied} onToggle={foldable ? () => setFolded(!folded) : undefined} />}
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
interface ThreadSummaryCardProps {
  reviewId: number;
  thread: ReviewThread;
  current: boolean;
  onOpen: () => void;
  onSeeApplied?: () => void;
  /** While the list is searched, the comment the words were found in, said in place of the thread's first words. */
  excerpt?: { author: string; text: string } | null;
}

export function ThreadSummaryCard({ reviewId, thread, current, onOpen, onSeeApplied, excerpt }: ThreadSummaryCardProps) {
  return (
    // Anywhere on the card goes to it, as its first words do: what's inside that does something else (a pill) does that.
    // The buttons inside stay the way there by keyboard.
    <section className={styles.thread} data-folded="true" data-opens="" data-current={current || undefined} onClick={(event) => clickedOutsideControls(event) && onOpen()}>
      <ThreadHeader reviewId={reviewId} thread={thread} folded cardOpens onSeeApplied={onSeeApplied} />
      <div className={styles.threadBody}>
        <FoldedThread thread={thread} onOpen={onOpen} excerpt={excerpt} />
      </div>
    </section>
  );
}

/** A click on the card itself, not on a control inside it, nor the end of a drag selecting its text to copy. */
function clickedOutsideControls(event: MouseEvent): boolean {
  if (window.getSelection()?.isCollapsed === false) return false;
  return event.target instanceof Element && event.target.closest('button, a, input, textarea, select, label, [role="button"]') === null;
}

interface ThreadHeaderProps {
  reviewId: number;
  thread: ReviewThread;
  folded: boolean;
  inCode?: ThreadInCode;
  /** The card around it goes to the thread (the Comments panel's): its location only names where, line included. */
  cardOpens?: boolean;
  /** Folds or unfolds a settled thread; none for one that stays whole. */
  onToggle?: () => void;
  onSeeApplied?: () => void;
}

function ThreadHeader({ reviewId, thread, folded, inCode, cardOpens = false, onToggle, onSeeApplied }: ThreadHeaderProps) {
  const { root } = thread;
  const badges = threadBadges(thread);
  // In the code, the thread is at its line: its location would name where the user already is.
  const anchor = root.anchor.kind === 'line' && !inCode ? root.anchor : null;
  const location = anchor && locationText(anchor);
  const replies = folded ? repliesText(thread) : undefined;

  return (
    <div className={styles.threadHeader}>
      <span className={styles.headerStart}>
        {onToggle && (
          <button type="button" className={styles.foldToggle} aria-expanded={!folded} aria-label={folded ? 'Show the thread' : 'Fold the thread'} onClick={onToggle}>
            <ChevronRight size={14} aria-hidden />
          </button>
        )}
        {(badges.kind || inCode) && <ThreadKindIcon root={root} />}
        {anchor && location && (cardOpens ? (
          // The card goes to the thread: its location only names where. Cut short, it names the whole path in its tooltip.
          <span className={styles.location} data-tip={`${location.folder}${location.file}${location.line}`} data-tip-overflow="">
            <LocationParts location={location} />
          </span>
        ) : (
          // The file, a link to it in Changes, opened at the comment.
          <>
            <button type="button" className={styles.location} data-tip="Show in Changes" data-tip-sub={`${location.folder}${location.file}`} onClick={() => navigation.openPage(commentLocationPage(reviewId, { ...root, anchor }))}>
              <LocationParts location={location} withLine={false} />
            </button>
            {/* Apart from the link, as text: the line it was written on, which an outdated comment's no longer is. */}
            <span className={styles.writtenLine} data-tip="The line it was written on">
              {writtenLineText(anchor)}
            </span>
          </>
        ))}
        {inCode && (
          // Cut short in a narrow card, it says its whole name in its tooltip.
          <span className={styles.kindLabel} data-tip={threadKindName(root)} data-tip-overflow="">
            {threadKindName(root)}
          </span>
        )}
        {inCode?.earlier &&
          (inCode.seeInContext ? (
            <button type="button" className={styles.earlierTag} data-tip="See when commented" data-tip-sub={inCode.earlier.tip} onClick={inCode.seeInContext}>
              {inCode.earlier.label}
            </button>
          ) : (
            <span className={styles.earlierTag} data-tip={inCode.earlier.tip}>
              {inCode.earlier.label}
            </span>
          ))}
      </span>
      <span className={styles.headerEnd}>
        {replies && <span className={styles.replyCount}>{replies}</span>}
        {badges.state && (
          <StatePill state={badges.state} appliedIn={badges.appliedIn} onSeeApplied={onSeeApplied} />
        )}
        {inCode?.hide && <IconButton size="small" icon={<X size={14} />} label={inCode.hide.label} onClick={inCode.hide.onHide} />}
      </span>
    </div>
  );
}

/**
 * Where a thread stands, as an outlined pill. "Applied in 281299" is one link as a whole, showing how the change
 * request was applied, in context (`onSeeApplied`), else opening the changeset that applied it: a chip inside the pill
 * would be a frame in a frame.
 */
function StatePill({ state, appliedIn, onSeeApplied }: { state: NonNullable<ThreadBadges['state']>; appliedIn: number | undefined; onSeeApplied?: () => void }) {
  if (appliedIn === undefined) {
    return (
      <span className={styles.pill} data-tone={state.tone}>
        {state.label}
      </span>
    );
  }
  return (
    <button
      type="button"
      className={styles.pill}
      data-tone={state.tone}
      data-tip={onSeeApplied ? 'See how it was applied' : `Open changeset ${appliedIn}`}
      onClick={onSeeApplied ?? (() => openChangesetDiff({ id: appliedIn }))}
    >
      {state.label} {appliedIn}
    </button>
  );
}

function LocationParts({ location, withLine = true }: { location: NonNullable<ReturnType<typeof locationText>>; withLine?: boolean }) {
  return (
    <>
      <span className={styles.locationFolder}>
        <Highlight text={location.folder} />
      </span>
      <span className={styles.locationFile}>
        <Highlight text={location.file} />
      </span>
      {withLine && <span className={styles.locationLine}>{location.line}</span>}
    </>
  );
}

/**
 * A settled thread folded: who started it and its first words, a click showing it whole. While a list is searched,
 * the comment the words were found in instead (`excerpt`), the words marked (`HighlightQuery`), as every list marks them.
 */
function FoldedThread({ thread, onOpen, excerpt }: { thread: ReviewThread; onOpen: () => void; excerpt?: ThreadSummaryCardProps['excerpt'] }) {
  const author = excerpt?.author ?? thread.root.author;
  return (
    <button type="button" className={styles.foldedLine} onClick={onOpen}>
      <Avatar user={author} size={16} tip={null} />
      <span className={styles.author}>
        <Highlight text={displayName(author)} />
      </span>
      <span className={styles.foldedText}>{excerpt ? <Highlight text={excerpt.text} /> : <CommentLine comment={thread.root.text} interactive={false} />}</span>
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
