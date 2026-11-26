import type { ModelPin } from '../../diff/viewer/model/modelAnnotations';
import type { Side } from '../../diff/viewer/model/viewLayout';
import { modelEarlierTagOf } from './earlierTag';
import type { ModelThread, ModelThreads, ThreadSide } from './fileThreads';
import { markerTip } from './markerTip';
import type { NewModelCommentSpot } from './newSpotComment';
import { newCommentPinKey, threadPinKey } from './reviewPins';

/** The version of a model a review thread's side of the diff shows. */
export function modelSideOf(side: ThreadSide): Side {
  return side === 'additions' ? 'after' : 'before';
}

interface ModelPinsInput {
  threads: ModelThreads;
  spots: readonly NewModelCommentSpot[];
  /** Comments show on the model; while hidden, only the one gone to does, and those being written. */
  inCode: boolean;
  /** The thread gone to or selected. */
  focusThreadId: number | undefined;
  /** The side the model's comments go on (`topSideOf`): a thread on an earlier version shows there. */
  topSide: ThreadSide;
}

/**
 * The pins a review's model shows, each with the avatar of who started it (docs/features/code-reviews.md "Comments on
 * 3D models"): each thread on a version a side shows at its spot there; one on an earlier version on the side comments
 * go on, dashed and tagged "Earlier version", the viewer placing it on its part as the part is now; each comment being
 * written. While comments are hidden, only the thread gone to and those being written show.
 */
export function reviewModelPinsOf({ threads, spots, inCode, focusThreadId, topSide }: ModelPinsInput): ModelPin[] {
  const shows = (thread: ModelThread): boolean => inCode || thread.root.id === focusThreadId;
  const placed = threads.placed.filter(({ thread }) => shows(thread)).map(({ thread, side }) => threadPin(thread, modelSideOf(side), false));
  const earlier = threads.earlier.filter(({ thread }) => shows(thread)).map(({ thread }) => threadPin(thread, modelSideOf(topSide), true));
  const writing = spots.map(
    (spot): ModelPin => ({ key: newCommentPinKey(spot.key), side: modelSideOf(spot.side), spot: spot.comment.spot, author: null, tip: 'New comment: drag it over the model to move it', emphasized: false, earlier: false, movable: true }),
  );
  return [...placed, ...earlier, ...writing];
}

function threadPin(thread: ModelThread, side: Side, earlier: boolean): ModelPin {
  const tip = markerTip({ threads: [{ thread }] });
  return {
    key: threadPinKey(thread.root.id),
    side,
    spot: thread.root.anchor.spot,
    author: thread.root.author,
    tip: earlier ? `${tip}\n${modelEarlierTagOf(thread, false).label}` : tip,
    emphasized: thread.state.kind === 'open',
    earlier,
    // `cm codereview comment edit` changes a comment's text only: a posted pin stays where it was written.
    movable: false,
  };
}
