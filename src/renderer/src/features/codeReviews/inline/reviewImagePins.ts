import type { ImagePin, ImageSide } from '../../diff/viewer/image/imageAnnotations';
import { imageEarlierTagOf } from './earlierTag';
import type { ImageThread, ImageThreads, ThreadSide } from './fileThreads';
import { markerTip } from './markerTip';
import type { NewImageCommentSpot } from './newImageComment';
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

/** The image a review thread's side of the diff shows. */
export function imageSideOf(side: ThreadSide): ImageSide {
  return side === 'additions' ? 'new' : 'old';
}

interface ImagePinsInput {
  threads: ImageThreads;
  spots: readonly NewImageCommentSpot[];
  /** Comments show on the image; while hidden, only the one gone to does, and those being written. */
  inCode: boolean;
  /** The thread gone to or selected. */
  focusThreadId: number | undefined;
  /** The side the image's comments go on (`topSideOf`): a thread on an earlier version shows there. */
  topSide: ThreadSide;
}

/**
 * The pins a review's image shows, each with the avatar of who started it (docs/features/code-reviews.md "Comments on images"): each thread on a version a
 * side shows at its spot there; one on an earlier version at its spot on the side comments go on, dashed and tagged
 * "Earlier version", as an image has no lines to follow; each comment being written. While comments are hidden in the
 * code, only the thread gone to and those being written show.
 */
export function reviewImagePinsOf({ threads, spots, inCode, focusThreadId, topSide }: ImagePinsInput): ImagePin[] {
  const shows = (thread: ImageThread): boolean => inCode || thread.root.id === focusThreadId;
  const placed = threads.placed.filter(({ thread }) => shows(thread)).map(({ thread, side }) => threadPin(thread, imageSideOf(side), false));
  const earlier = threads.earlier.filter(({ thread }) => shows(thread)).map(({ thread }) => threadPin(thread, imageSideOf(topSide), true));
  const writing = spots.map(
    (spot): ImagePin => ({ key: newCommentPinKey(spot.key), side: imageSideOf(spot.side), spot: spot.comment.spot, author: null, tip: 'New comment: drag to move it', emphasized: false, earlier: false, movable: true }),
  );
  return [...placed, ...earlier, ...writing];
}

function threadPin(thread: ImageThread, side: ImageSide, earlier: boolean): ImagePin {
  const tip = markerTip({ threads: [{ thread }] });
  return {
    key: threadPinKey(thread.root.id),
    side,
    spot: thread.root.anchor.spot,
    author: thread.root.author,
    tip: earlier ? `${tip}\n${imageEarlierTagOf(thread).label}` : tip,
    emphasized: thread.state.kind === 'open',
    earlier,
    // `cm codereview comment edit` changes a comment's text only: a posted pin stays where it was written.
    movable: false,
  };
}

/** A thread on the image, and whether it was written on an earlier version of it; none for one not on it. */
export function imageThreadOf(threads: ImageThreads, threadId: number): { thread: ImageThread; earlier: boolean } | null {
  const placed = threads.placed.find((entry) => entry.thread.root.id === threadId);
  if (placed) return { thread: placed.thread, earlier: false };
  const earlier = threads.earlier.find((entry) => entry.thread.root.id === threadId);
  return earlier ? { thread: earlier.thread, earlier: true } : null;
}

/** The ids of the image's threads. */
export function imageThreadIdsOf(threads: ImageThreads | null): ReadonlySet<number> {
  return new Set(threads ? [...threads.placed, ...threads.earlier].map((entry) => entry.thread.root.id) : []);
}

/**
 * The pin a thread gone to opens and brings into view (from the Comments panel, the keys, the conversation): once per
 * time it's gone to (`lastSeq`, the one revealed last), never for one picked in place, on screen already, nor for a
 * thread of another file.
 */
export function pinRevealedBy(focus: ThreadFocus | null, threads: ImageThreads | null, lastSeq: number | undefined): { key: string; seq: number } | null {
  if (!focus || focus.inPlace || focus.seq === lastSeq || !threads || !imageThreadOf(threads, focus.threadId)) return null;
  return { key: threadPinKey(focus.threadId), seq: focus.seq };
}

/** The pin whose card is open: the one opened in this file, while it still has that pin (a draft sent, a thread gone). */
export function openedPin(pins: readonly ImagePin[], opened: { path: string; key: string } | null, path: string): string | null {
  return opened?.path === path && pins.some((pin) => pin.key === opened.key) ? opened.key : null;
}
