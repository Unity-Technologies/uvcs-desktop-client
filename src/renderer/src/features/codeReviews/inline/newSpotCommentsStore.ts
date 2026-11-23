import { create } from 'zustand';
import type { LineCommentKind } from '@shared/domain/reviewConversation';
import type { ThreadSide } from './fileThreads';

/** A comment being written on a spot of a review's diff (a point or an area of an image, a point or a part of a model). */
export interface NewSpotComment<Spot> {
  /** Names it among the review's, its pin, and its draft: made with a serial, never from its spot, which moves. */
  key: string;
  reviewId: number;
  /** The file's, as the diff names it: what finds it again once the file's newest revision changed. */
  path: string;
  side: ThreadSide;
  comment: { revisionId: number; spot: Spot; kind: LineCommentKind; changesetId?: number };
}

export interface NewSpotComments<Draft extends NewSpotComment<unknown>> {
  /** The comments being written, in every review of the window, oldest first. */
  spots: Draft[];
  /** The serial the next comment started takes, never repeated while the window lives. */
  serial: number;
  /** Starts a comment, made with the next serial; returns it. */
  start: (make: (serial: number) => Draft) => Draft;
  setKind: (key: string, kind: LineCommentKind) => void;
  /** Moves or reshapes it before it's sent; its key, and so its draft, stay. */
  moveTo: (key: string, spot: Draft['comment']['spot']) => void;
  /** Sent or canceled: its pin goes. */
  close: (key: string) => void;
}

/**
 * The comments being written on spots of reviews' diffs of one kind, while the window lives, as those on lines are
 * (`useNewLineCommentsStore`); their text is in `useCommentDraftStore`. Not saved.
 */
export function createNewSpotCommentsStore<Draft extends NewSpotComment<unknown>>() {
  return create<NewSpotComments<Draft>>((set, get) => ({
    spots: [],
    serial: 0,
    start: (make) => {
      const spot = make(get().serial + 1);
      set((state) => ({ serial: state.serial + 1, spots: [...state.spots, spot] }));
      return spot;
    },
    setKind: (key, kind) => set((state) => ({ spots: state.spots.map((spot) => (spot.key === key ? { ...spot, comment: { ...spot.comment, kind } } : spot)) })),
    moveTo: (key, spot) => set((state) => ({ spots: state.spots.map((open) => (open.key === key ? { ...open, comment: { ...open.comment, spot } } : open)) })),
    close: (key) => set((state) => ({ spots: state.spots.filter((spot) => spot.key !== key) })),
  }));
}
