import type { ImagePin, ImageSide } from '../../diff/viewer/image/imageAnnotations';
import { imageEarlierTagOf } from './earlierTag';
import type { ImageThread, ImageThreads, ThreadSide } from './fileThreads';
import { markerTip } from './markerTip';
import type { NewImageCommentSpot } from './newSpotComment';
import { newCommentPinKey, threadPinKey } from './reviewPins';

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
