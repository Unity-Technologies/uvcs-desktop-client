import { create } from 'zustand';
import type { ImageSpot, LineCommentKind } from '@shared/domain/reviewConversation';
import type { NewImageCommentSpot } from './newImageComment';

interface NewImageComments {
  /** The comments being written on images, in every review of the window, oldest first. */
  spots: NewImageCommentSpot[];
  /** The serial the next comment started takes (`newImageCommentSpot`), never repeated while the window lives. */
  serial: number;
  /** Starts a comment, made with the next serial; returns it. */
  start: (make: (serial: number) => NewImageCommentSpot) => NewImageCommentSpot;
  setKind: (key: string, kind: LineCommentKind) => void;
  /** Moves or reshapes it before it's sent; its key, and so its draft, stay. */
  moveTo: (key: string, spot: ImageSpot) => void;
  /** Sent or canceled: its pin goes. */
  close: (key: string) => void;
}

/**
 * The comments being written on images of reviews' diffs, while the window lives, as those on lines are
 * (`useNewLineCommentsStore`); their text is in `useCommentDraftStore`. Not saved.
 */
export const useNewImageCommentsStore = create<NewImageComments>((set, get) => ({
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
