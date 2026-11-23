// What a review's pins are, whatever they're on (an image, a 3D model): each thread's pin by its id, the card open,
// the pin a thread gone to opens. The spots and the words are each kind's (`reviewImagePins`).

import type { ReviewThread } from '../conversation/reviewThreads';
import type { ThreadFocus } from './reviewComments';

/** A thread's pin, by its id; a comment being written has its own (`newCommentPinKey`). */
export function threadPinKey(threadId: number): string {
  return `thread:${threadId}`;
}

export function newCommentPinKey(spotKey: string): string {
  return `new:${spotKey}`;
}

/** The thread a pin is of, if it is a thread's. */
export function pinThreadId(key: string): number | null {
  const match = /^thread:(\d+)$/.exec(key);
  return match ? Number(match[1]) : null;
}

/** A file's threads on spots: those on a version a side shows, and those on an earlier one. */
export interface SpotThreads<T extends ReviewThread> {
  placed: readonly { thread: T }[];
  earlier: readonly { thread: T }[];
}

/** A thread on the file's spots, and whether it was written on an earlier version; none for one not on them. */
export function spotThreadOf<T extends ReviewThread>(threads: SpotThreads<T>, threadId: number): { thread: T; earlier: boolean } | null {
  const placed = threads.placed.find((entry) => entry.thread.root.id === threadId);
  if (placed) return { thread: placed.thread, earlier: false };
  const earlier = threads.earlier.find((entry) => entry.thread.root.id === threadId);
  return earlier ? { thread: earlier.thread, earlier: true } : null;
}

/** The ids of the file's threads on spots. */
export function spotThreadIdsOf(threads: SpotThreads<ReviewThread> | null): ReadonlySet<number> {
  return new Set(threads ? [...threads.placed, ...threads.earlier].map((entry) => entry.thread.root.id) : []);
}

/**
 * The pin a thread gone to opens and brings into view (from the Comments panel, the keys, the conversation): once per
 * time it's gone to (`lastSeq`, the one revealed last), never for one picked in place, on screen already, nor for a
 * thread of another file.
 */
export function pinRevealedBy(focus: ThreadFocus | null, threads: SpotThreads<ReviewThread> | null, lastSeq: number | undefined): { key: string; seq: number } | null {
  if (!focus || focus.inPlace || focus.seq === lastSeq || !threads || !spotThreadOf(threads, focus.threadId)) return null;
  return { key: threadPinKey(focus.threadId), seq: focus.seq };
}

/** The pin whose card is open: the one opened in this file, while it still has that pin (a draft sent, a thread gone). */
export function openedPin(pins: readonly { key: string }[], opened: { path: string; key: string } | null, path: string): string | null {
  return opened?.path === path && pins.some((pin) => pin.key === opened.key) ? opened.key : null;
}
