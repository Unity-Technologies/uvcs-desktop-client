import { createContext, type ReactNode } from 'react';
import type { ModelSpot } from '@shared/domain/reviewConversation';
import type { CommentPin } from '../pins/commentPin';
import type { Side } from './viewLayout';

/** A comment's pin on a 3D model (`CommentPin`): its tip on a point of the surface of the version `side` names. */
export type ModelPin = CommentPin<ModelSpot> & { side: Side };

/**
 * What a place adds to a model's diff without the diff knowing what it adds (a review's comments, docs/features/
 * code-reviews.md "Comments on 3D models"), as `ImageAnnotations` adds pins to an image.
 */
export interface ModelAnnotations {
  pins: readonly ModelPin[];
  /** The pin whose card shows beside it: one at a time, as a click on another opens that one. */
  opened: string | null;
  /** The pin of the thread selected, ringed in the accent. */
  selected: string | null;
  /** Opens a pin's card, or closes the one open (`null`). */
  onOpen: (key: string | null) => void;
  /**
   * The card beside an opened pin: its thread, or the comment being written there. `placed`: what the viewer found
   * placing it on the version shown (its part not there).
   */
  renderCard: (key: string, placed: { partGone: boolean }) => ReactNode;
  /** The version that takes new comments: the revision the place comments on; none when it takes none. */
  commentsOn: Side | null;
  /** Starts a comment on a spot of the version `commentsOn` names. */
  addComment: (spot: ModelSpot) => void;
  /** Moves a movable pin's spot, or changes what it's about (a point, its whole part). */
  moveComment: (key: string, spot: ModelSpot) => void;
  /** A pin to show, the camera going to it, each time `seq` changes. */
  reveal: { key: string; seq: number } | null;
}

export const ModelAnnotationsContext = createContext<ModelAnnotations | null>(null);

/** Whether the viewer offers to comment on the model: the place takes comments on a version, and that version shows. */
export function takesModelComments(annotations: Pick<ModelAnnotations, 'commentsOn'> | null, shown: Record<Side, boolean>): boolean {
  return annotations?.commentsOn != null && shown[annotations.commentsOn];
}

/**
 * The part a comment lights up, as an image's area shows only on demand: the part of a comment on a whole part, while
 * its bubble is pointed at or focused (`pointed`), its card open, or it's being written. None while Diffs by look
 * compares (a part lit would compare as a change), nor for a comment on a point.
 */
export function litCommentPart(pins: readonly ModelPin[], opened: string | null, pointed: string | null, comparesLooks: boolean): ModelPin | null {
  if (comparesLooks) return null;
  const lights = (pin: ModelPin) => pin.spot.wholePart === true && pin.spot.node !== undefined;
  return pins.find((pin) => pin.key === pointed && lights(pin)) ?? pins.find((pin) => pin.key === opened && lights(pin)) ?? pins.find((pin) => pin.author === null && lights(pin)) ?? null;
}
