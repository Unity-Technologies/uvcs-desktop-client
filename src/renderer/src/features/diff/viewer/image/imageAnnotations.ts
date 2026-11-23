import { createContext, type ReactNode } from 'react';
import type { ImageSpot } from '@shared/domain/reviewConversation';

/** The revision of an image a pin is on: the diff's older side, or its newer one. */
export type ImageSide = 'old' | 'new';

/**
 * A comment's pin on an image: a speech bubble holding the avatar of who started it, its tip at a point, or at the top-left
 * corner of an area it outlines.
 */
export interface ImagePin {
  key: string;
  side: ImageSide;
  spot: ImageSpot;
  /** Who started it, whose avatar the bubble holds; none for a comment being written, which shows a plus. */
  author: string | null;
  /** The marker's tooltip, and what a screen reader hears. */
  tip: string;
  /** Something there is still open: the Open color, as a line's marker; a quiet gray once settled. */
  emphasized: boolean;
  /** Written on an earlier version of the image, which may show something else there now: drawn dashed. */
  earlier: boolean;
  /** Its spot can still change (a comment being written): its bubble drags it, its area's corners reshape it. */
  movable: boolean;
}

/**
 * What a place adds to an image's diff without the diff knowing what it adds (a review's comments, docs/features/
 * code-reviews.md "Comments on images"), as `DiffAnnotations` adds rows under lines of code.
 */
export interface ImageAnnotations {
  pins: readonly ImagePin[];
  /** The pin whose card shows beside it: one at a time, as a click on another opens that one. */
  opened: string | null;
  /** The pin of the thread selected, ringed in the accent. */
  selected: string | null;
  /** Opens a pin's card, or closes the one open (`null`). */
  onOpen: (key: string | null) => void;
  /** The card beside an opened pin: its thread, or the comment being written there. */
  renderCard: (key: string) => ReactNode;
  /** The side whose image takes new comments: the revision the place comments on; none when it takes none. */
  commentsOn: ImageSide | null;
  /** Starts a comment on a point or an area of the image `commentsOn` names. */
  addComment: (spot: ImageSpot) => void;
  /** Moves or reshapes a movable pin's spot. */
  moveComment: (key: string, spot: ImageSpot) => void;
  /** A pin to bring into view, at the zoom shown, each time `seq` changes. */
  reveal: { key: string; seq: number } | null;
}

export const ImageAnnotationsContext = createContext<ImageAnnotations | null>(null);

/**
 * Whether the viewer offers to comment on the image: the place takes comments on a side, and that side's image shows
 * (an image added has no older side, one deleted no newer).
 */
export function takesComments(annotations: Pick<ImageAnnotations, 'commentsOn'> | null, shown: Partial<Record<ImageSide, unknown>>): boolean {
  return annotations?.commentsOn != null && shown[annotations.commentsOn] != null;
}
