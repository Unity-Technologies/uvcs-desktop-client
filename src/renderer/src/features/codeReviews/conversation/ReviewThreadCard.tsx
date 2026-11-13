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
import { answerOf, commentLocationPage, replyAction, startsFolded } from './threadBadges';
import { commentElementId, threadElementId } from './threadPick';
import { hasThreadHeader, threadHeaderOf, type HeaderLocation, type HeaderPill } from './threadHeader';
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
  /** The thread selected in the code, gone to or picked there (`cardFocusOf`): ringed in the accent, as its line is. */
  selected?: boolean;
  /** The reply gone to with the thread (`threadMarkOf`, a link's): lit in place of the whole card. */
  litReply?: number;
  /** What "Applied" opens: how the change request was applied, in context; else the changeset that applied it. */
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
  /** Shown in context (`CommentContextDialog`): its "Applied" names the changeset the dialog shows, and opens nothing. */
  inContext?: true;
  /**
   * What the "Earlier version" or "Outdated" tag opens: the diff it was written on, and what was done since
   * (`openCommentContextDialog`, on "When commented"), as "Applied" opens it on how it was applied.
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
export function ReviewThreadCard({ review, thread, user, inCode, highlight, selected = false, litReply, onSeeApplied }: ReviewThreadCardProps) {
  const [folded, setFolded] = useState(() => startsFolded(thread) && highlight === undefined);
  const [shownHighlight, setShownHighlight] = useState(highlight);
  // The Answered pill's: the reply that answered, gone to the how-many-th time.
  const [answerShown, setAnswerShown] = useState<{ replyId: number; seq: number } | null>(null);
  const answer = answerOf(thread);
  const seeAnswer = answer && (() => {
    setFolded(false);
    setAnswerShown((shown) => ({ replyId: answer.replyId, seq: (shown?.seq ?? -1) + 1 }));
  });
  const foldable = startsFolded(thread);
  const hasHeader = hasThreadHeader(thread);
  // Gone to again: shown whole, as what was asked for.
  if (highlight !== shownHighlight) {
    setShownHighlight(highlight);
    if (highlight !== undefined) setFolded(false);
    setAnswerShown(highlight !== undefined && litReply !== undefined ? { replyId: litReply, seq: highlight } : null);
  }
  const threadActions = inCode && { showInConversation: inCode.showInConversation };

  return (
    <section
      className={styles.thread}
      data-folded={folded}
      data-in-code={inCode ? '' : undefined}
      data-highlight={highlight === undefined || litReply !== undefined ? undefined : highlight % 2}
      data-selected={selected || undefined}
      {...(inCode && highlight !== undefined && { [ROW_FOCUS_ATTRIBUTE]: '' })}
      id={inCode ? undefined : threadElementId(thread.root.id)}
    >
      {hasHeader && <ThreadHeader reviewId={review.id} thread={thread} folded={folded} inCode={inCode} onSeeApplied={onSeeApplied} onSeeAnswer={seeAnswer} onToggle={foldable ? () => setFolded(!folded) : undefined} />}
      {inCode?.snippet}
      {/* Named for a place that bounds the card's height and scrolls its body (See in context's thread above the files). */}
      <div className={styles.threadBody} data-thread-body="">
        {folded ? (
          // The header's fold toggle is the keyboard's way to unfold it: the line is a second way for the pointer only.
          <FoldedThread thread={thread} onOpen={() => setFolded(false)} pointerOnly={foldable} />
        ) : (
          <WholeThread review={review} thread={thread} user={user} threadActions={threadActions} lit={answerShown ?? undefined} commentIds={!inCode} />
        )}
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

/**
 * A thread under its file's name in the Comments panel (`CommentsFileGroup`): its kind's icon leading it, as a list's
 * bullet; who started it, the line it was written on and its replies, then where it stands; its first words under them,
 * the row's whole width. As a card, anywhere on it goes to the thread, and its words are the way there by keyboard.
 */
export function ThreadSummaryRow({ thread, current, onOpen, onSeeApplied, excerpt }: Omit<ThreadSummaryCardProps, 'reviewId'>) {
  const header = threadHeaderOf({ thread, place: 'fileGroup', folded: true, foldable: false, hides: false, seesHowApplied: onSeeApplied !== undefined, showsAnswer: false, inContext: false });
  const author = excerpt?.author ?? thread.root.author;
  return (
    <section className={styles.row} data-current={current || undefined} onClick={(event) => clickedOutsideControls(event) && onOpen()}>
      {header.kindIcon && <ThreadKindIcon root={thread.root} />}
      <span className={styles.rowAbout}>
        <Avatar user={author} size={16} tip={null} />
        <span className={styles.author}>
          <Highlight text={displayName(author)} />
        </span>
        {header.line && (
          <span className={styles.rowLine} data-tip="The line it was written on">
            {header.line}
          </span>
        )}
        {header.replies && <span className={styles.replyCount}>{header.replies}</span>}
      </span>
      {header.pill && (
        <span className={styles.rowState}>
          <StatePill pill={header.pill} onSeeApplied={onSeeApplied} />
        </span>
      )}
      <button type="button" className={styles.rowText} onClick={onOpen}>
        <span className={styles.foldedText}>{excerpt ? <Highlight text={excerpt.text} /> : <CommentLine comment={thread.root.text} interactive={false} />}</span>
      </button>
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
  /** The card around it goes to the thread (the Comments panel's): its file only names where, not a link of its own. */
  cardOpens?: boolean;
  /** Folds or unfolds a settled thread; none for one that stays whole. */
  onToggle?: () => void;
  onSeeApplied?: () => void;
  /** What "Answered" does: shows the thread whole at the reply that answered it (`answerOf`). */
  onSeeAnswer?: () => void;
}

function ThreadHeader({ reviewId, thread, folded, inCode, cardOpens = false, onToggle, onSeeApplied, onSeeAnswer }: ThreadHeaderProps) {
  const { root } = thread;
  const header = threadHeaderOf({
    thread,
    place: inCode ? 'code' : cardOpens ? 'panel' : 'conversation',
    folded,
    foldable: onToggle !== undefined,
    earlier: inCode?.earlier && { ...inCode.earlier, opensContext: inCode.seeInContext !== undefined },
    hides: inCode?.hide !== undefined,
    seesHowApplied: onSeeApplied !== undefined,
    showsAnswer: onSeeAnswer !== undefined,
    inContext: inCode?.inContext === true,
  });
  const { location, earlierTag, pill } = header;
  const anchor = root.anchor.kind === 'line' ? root.anchor : null;

  return (
    <div className={styles.threadHeader}>
      <span className={styles.headerStart}>
        {header.foldToggle && (
          <button type="button" className={styles.foldToggle} aria-expanded={header.foldToggle.expanded} aria-label={header.foldToggle.label} onClick={onToggle}>
            <ChevronRight size={14} aria-hidden />
          </button>
        )}
        {header.kindIcon && <ThreadKindIcon root={root} />}
        {location && anchor && (location.linked ? (
          <>
            {/* The file, a link to it in Changes, opened at the comment. */}
            <button type="button" className={styles.location} data-tip={location.tip} data-tip-sub={location.tipSub} onClick={() => navigation.openPage(commentLocationPage(reviewId, { ...root, anchor }))}>
              <LocationParts location={location} />
            </button>
            <WrittenLine line={location.line} />
          </>
        ) : (
          // The card goes to the thread: its file and line only name where, the line inside so that, cut short, the
          // folder gives way first, then the line, the file's name last. The whole path and line in its tooltip.
          <span className={styles.location} data-tip={location.tip} data-tip-overflow="">
            <LocationParts location={location} />
            <WrittenLine line={location.line} />
          </span>
        ))}
        {header.kindLabel && (
          // Cut short in a narrow card, it says its whole name in its tooltip.
          <span className={styles.kindLabel} data-tip={header.kindLabel} data-tip-overflow="">
            {header.kindLabel}
          </span>
        )}
        {earlierTag &&
          (earlierTag.opensContext ? (
            <button type="button" className={styles.earlierTag} data-tip="See when commented" data-tip-sub={earlierTag.tip} onClick={inCode?.seeInContext}>
              {earlierTag.label}
            </button>
          ) : (
            <span className={styles.earlierTag} data-tip={earlierTag.tip}>
              {earlierTag.label}
            </span>
          ))}
      </span>
      <span className={styles.headerEnd}>
        {header.replies && <span className={styles.replyCount}>{header.replies}</span>}
        {pill && <StatePill pill={pill} onSeeApplied={onSeeApplied} onSeeAnswer={onSeeAnswer} />}
        {header.hides && inCode?.hide && <IconButton size="small" icon={<X size={14} />} label={inCode.hide.label} onClick={inCode.hide.onHide} />}
      </span>
    </div>
  );
}

interface StatePillProps {
  pill: HeaderPill;
  onSeeApplied?: () => void;
  onSeeAnswer?: () => void;
}

/**
 * Where a thread stands, as an outlined pill. "Applied" is one link as a whole, showing how the change
 * request was applied, in context (`onSeeApplied`), else opening the changeset that applied it: a chip inside the pill
 * would be a frame in a frame. "Answered" is one too, to the reply that answered (`onSeeAnswer`).
 */
function StatePill({ pill, onSeeApplied, onSeeAnswer }: StatePillProps) {
  switch (pill.leadsTo) {
    case 'answer':
      return (
        <button type="button" className={styles.pill} data-tone={pill.tone} data-tip={pill.tip} onClick={onSeeAnswer}>
          {pill.label}
        </button>
      );
    case 'applied': {
      const { changesetId } = pill;
      return (
        <button type="button" className={styles.pill} data-tone={pill.tone} data-tip={pill.tip} onClick={onSeeApplied ?? (() => openChangesetDiff({ id: changesetId }))}>
          {pill.label}
        </button>
      );
    }
    case 'context':
      return (
        <button type="button" className={styles.pill} data-tone={pill.tone} data-tip={pill.tip} onClick={onSeeApplied}>
          {pill.label}
        </button>
      );
    case 'nothing':
      return (
        <span className={styles.pill} data-tone={pill.tone} data-tip={pill.tip}>
          {pill.label}
        </span>
      );
  }
}

/** Apart from the file, as text: the line it was written on, which an outdated comment's no longer is. */
function WrittenLine({ line }: { line: string }) {
  return (
    <span className={styles.writtenLine} data-tip="The line it was written on">
      {line}
    </span>
  );
}

function LocationParts({ location }: { location: Pick<HeaderLocation, 'folder' | 'file'> }) {
  return (
    <>
      <span className={styles.locationFolder}>
        <Highlight text={location.folder} />
      </span>
      <span className={styles.locationFile}>
        <Highlight text={location.file} />
      </span>
    </>
  );
}

/**
 * A settled thread folded: who started it and its first words, a click showing it whole. While a list is searched,
 * the comment the words were found in instead (`excerpt`), the words marked (`HighlightQuery`), as every list marks them.
 */
function FoldedThread({ thread, onOpen, excerpt, pointerOnly = false }: { thread: ReviewThread; onOpen: () => void; excerpt?: ThreadSummaryCardProps['excerpt']; pointerOnly?: boolean }) {
  const author = excerpt?.author ?? thread.root.author;
  return (
    <button type="button" className={styles.foldedLine} onClick={onOpen} tabIndex={pointerOnly ? -1 : undefined}>
      <Avatar user={author} size={16} tip={null} />
      <span className={styles.author}>
        <Highlight text={displayName(author)} />
      </span>
      <span className={styles.foldedText}>{excerpt ? <Highlight text={excerpt.text} /> : <CommentLine comment={thread.root.text} interactive={false} />}</span>
    </button>
  );
}

/** Every comment of the thread, then a reply box, and Discard for a change request someone else asked for. */
interface WholeThreadProps {
  review: Pick<CodeReview, 'owner'>;
  thread: ReviewThread;
  user: string | undefined;
  threadActions?: ThreadActions;
  lit?: { replyId: number; seq: number };
  /** In the conversation, each comment's element has its id (`commentElementId`), which going to a reply scrolls to. */
  commentIds: boolean;
}

function WholeThread({ review, thread, user, threadActions, lit, commentIds }: WholeThreadProps) {
  const place = usePlace();
  const [answering, setAnswering] = useState<Answering>(null);
  const { root, replies } = thread;

  return (
    <>
      <ReviewCommentView comment={root} thread={thread} user={user} byReviewAuthor={isAuthor(review, root.author)} threadActions={threadActions} />
      {replies.map((reply) => (
        <ReviewCommentView
          key={reply.id}
          comment={reply}
          thread={thread}
          user={user}
          action={replyAction(reply)}
          byReviewAuthor={isAuthor(review, reply.author)}
          lit={lit?.replyId === reply.id ? lit.seq : undefined}
          elementId={commentIds ? commentElementId(reply.id) : undefined}
        />
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
