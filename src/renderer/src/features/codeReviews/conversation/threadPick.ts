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
 * The page opened at a thread, or moved to another: that one becomes current. A tab shown as it is (no thread to go to)
 * keeps the one picked.
 */
export function pickOnFocus(previous: ThreadPick | undefined, focusThread: number | undefined): ThreadPick | undefined {
  return focusThread === undefined ? previous : { threadId: focusThread, seq: nextSeq(previous), by: 'page' };
}

function nextSeq(previous: ThreadPick | undefined): number {
  return (previous?.seq ?? 0) + 1;
}

/** How a thread's card shows the pick: lit for a moment (`highlight`) and ringed while it's the current one. */
export function threadMarkOf(threadId: number, pick: ThreadPick | undefined): { highlight: number | undefined; selected: boolean } {
  const picked = pick?.threadId === threadId;
  return { highlight: picked ? pick.seq : undefined, selected: picked };
}

/**
 * How the conversation brings the picked thread into view. One picked in Open glides only as far as it must: on screen
 * it stays where it is (its light says which), off screen it comes to the nearest edge, as an answer gone to does
 * (`ReviewCommentView`). The page opened at one shows it centered, at once.
 */
export function pickedScrollOf(pick: ThreadPick): ScrollIntoViewOptions {
  return pick.by === 'rail' ? { block: 'nearest', behavior: 'smooth' } : { block: 'center', behavior: 'auto' };
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
