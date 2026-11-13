import type { PageOf } from '../../../app/navigation/pages';
import { commentLineText } from '../../../lib/comments/commentText';
import { anchorPath, isLineThread } from '../inline/fileThreads';
import type { ReviewThread } from './reviewThreads';
import { commentLocationPage } from './threadBadges';

/**
 * The thread the conversation has gone to: picked in the rail's **Open**, or the one the page was opened at ("Show in
 * conversation", from the code). It stays the current one, ringed in the conversation and marked in Open, until another
 * is. Each pick counts (`seq`), so picking the same thread again lights it again.
 */
export interface ThreadPick {
  /** The thread's first comment's id. */
  threadId: number;
  /** A reply in it to go to, the one a link names: lit and brought into view in place of the thread. */
  replyId?: number;
  /** Which pick this is, counting every one: the card's light restarts when it changes (`ReviewThreadCard.highlight`). */
  seq: number;
  /** In the rail (scrolled to, gliding), or by the page opening at it (shown at once). */
  by: 'rail' | 'page';
}

/** A thread picked in Open. */
export function pickThread(previous: ThreadPick | undefined, threadId: number): ThreadPick {
  return { threadId, seq: nextSeq(previous), by: 'rail' };
}

/**
 * The page opened at a thread, or moved to another: that one becomes current, at the reply the page names. A tab shown
 * as it is (no thread to go to) keeps the one picked.
 */
export function pickOnFocus(previous: ThreadPick | undefined, focusThread: number | undefined, focusReply?: number): ThreadPick | undefined {
  if (focusThread === undefined) return previous;
  return { threadId: focusThread, ...(focusReply !== undefined && { replyId: focusReply }), seq: nextSeq(previous), by: 'page' };
}

function nextSeq(previous: ThreadPick | undefined): number {
  return (previous?.seq ?? 0) + 1;
}

/**
 * How a thread's card shows the pick: unfolded and lit for a moment (`highlight`), ringed while it's the current one;
 * at a reply (`litReply`), the reply lit rather than the whole card.
 */
export function threadMarkOf(threadId: number, pick: ThreadPick | undefined): { highlight: number | undefined; selected: boolean; litReply?: number } {
  const picked = pick?.threadId === threadId;
  return { highlight: picked ? pick.seq : undefined, selected: picked, ...(picked && pick.replyId !== undefined && { litReply: pick.replyId }) };
}

/** The answer the Answered pill went to, the how-many-th time, and the card's light (`highlight`) it was pressed under. */
export interface AnswerLight {
  replyId: number;
  seq: number;
  underHighlight: number | undefined;
}

/**
 * What a thread's card lights: the card itself (`cardHighlight`), or one of its comments (`litComment`). `event`
 * names what lit the comment (a pick, a press of the pill), so a new one lights it again (`commentLightShown`).
 * `scrolls` says whether the comment brings itself into view: the answer the Answered pill goes to does; a reply a
 * link goes to doesn't, the conversation scrolling to it (`pickedElementId`).
 */
export interface CardLight {
  cardHighlight?: number;
  litComment?: { replyId: number; event: string; scrolls: boolean };
}

/** A comment's light as the card shows it: `seq` counts the lights the card showed, so each new one changes parity. */
export interface ShownCommentLight {
  replyId: number;
  event: string;
  scrolls: boolean;
  seq: number;
}

/**
 * How a card shows what it was gone to and what was pressed in it: from props, so a card mounting at a reply (a link
 * opened cold) lights it from its first render. A pick at a reply (`litReply`) lights the reply, not the card. The
 * answer the pill went to stays lit across later picks with no reply, as it always did; between it and a pick at a
 * reply, whichever came last: the answer when pressed under the card's current light.
 */
export function cardLightOf(highlight: number | undefined, litReply: number | undefined, answer: AnswerLight | null): CardLight {
  const answerLit = answer && { replyId: answer.replyId, event: `answer ${answer.seq}`, scrolls: true };
  if (highlight === undefined || litReply === undefined) return { ...(highlight !== undefined && { cardHighlight: highlight }), ...(answerLit && { litComment: answerLit }) };
  if (answerLit && answer.underHighlight === highlight) return { litComment: answerLit };
  return { litComment: { replyId: litReply, event: `pick ${highlight}`, scrolls: false } };
}

/** The Answered pill pressed: its answer lit next, under the card's light now (`highlight`). */
export function nextAnswerLight(previous: AnswerLight | null, replyId: number, highlight: number | undefined): AnswerLight {
  return { replyId, seq: (previous?.seq ?? -1) + 1, underHighlight: highlight };
}

/**
 * The comment light a card shows next, from the one it shows: the same while nothing new lit a comment; one counted
 * past it for a new pick or press, so its parity (`data-highlight`) changes and the light restarts, on the same reply
 * too. Picks and presses count apart, so their own numbers can't say it.
 */
export function commentLightShown(shown: ShownCommentLight | undefined, light: CardLight): ShownCommentLight | undefined {
  const lit = light.litComment;
  if (!lit) return shown;
  if (shown?.event === lit.event && shown.replyId === lit.replyId) return shown;
  return { ...lit, seq: (shown?.seq ?? 0) + 1 };
}

/** The element the conversation brings into view for a pick: the thread's, or the reply's it goes to. */
export function pickedElementId(pick: ThreadPick): string {
  return pick.replyId === undefined ? threadElementId(pick.threadId) : commentElementId(pick.replyId);
}

/**
 * How the conversation brings the picked thread into view. One picked in Open glides only as far as it must: on screen
 * it stays where it is (its light says which), off screen it comes to the nearest edge, as an answer gone to does
 * (`ReviewCommentView`). The page opened at one shows it centered, at once.
 */
export function pickedScrollOf(pick: ThreadPick): ScrollIntoViewOptions {
  return pick.by === 'rail' ? { block: 'nearest', behavior: 'smooth' } : { block: 'center', behavior: 'auto' };
}

/** The thread's element in the conversation, which going to it scrolls to. */
export function threadElementId(commentId: number): string {
  return `review-thread-${commentId}`;
}

/** A comment's element in the conversation, which going to it scrolls to (a reply a link names). */
export function commentElementId(commentId: number): string {
  return `review-comment-${commentId}`;
}

/** An entry of the rail's Open: what the thread says, in a line, and whether it's the current one. */
export interface OpenItem {
  threadId: number;
  thread: ReviewThread;
  text: string;
  current: boolean;
  /**
   * Where "Show in Changes" goes, as the thread card's file link does (`commentLocationPage`): its file in the Changes
   * tab, in the mode it was written in, at the thread. None for a comment on the whole review, which is in no file.
   */
  inChanges?: { page: PageOf<'codeReview'>; path: string };
}

/** The rail's Open: each open thread, the picked one current. */
export function openItemsOf(reviewId: number, open: readonly ReviewThread[], pick: ThreadPick | undefined): OpenItem[] {
  return open.map((thread) => ({
    threadId: thread.root.id,
    thread,
    text: commentLineText(thread.root.text),
    current: pick?.threadId === thread.root.id,
    inChanges: isLineThread(thread) ? { page: commentLocationPage(reviewId, thread.root), path: anchorPath(thread.root.anchor) } : undefined,
  }));
}
