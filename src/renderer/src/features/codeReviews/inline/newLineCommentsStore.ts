import { create } from 'zustand';
import type { LineCommentKind } from '@shared/domain/reviewConversation';
import type { NewLineCommentSpot } from './newLineComment';

interface NewLineComments {
  /** The comments being written on lines, in every review of the window, oldest first. */
  spots: NewLineCommentSpot[];
  /** Starts a comment on a line; one already started there stays as it is, its kind and text kept. */
  open: (spot: NewLineCommentSpot) => void;
  setKind: (key: string, kind: LineCommentKind) => void;
  /** Sent or canceled: its row goes. */
  close: (key: string) => void;
}

/**
 * The comments being written on lines of reviews' diffs, while the window lives (as their text is: `useCommentDraftStore`).
 * Not saved: a comment half written is the window's, as a reply being written is.
 */
export const useNewLineCommentsStore = create<NewLineComments>((set) => ({
  spots: [],
  open: (spot) => set((state) => (state.spots.some((open) => open.key === spot.key) ? state : { spots: [...state.spots, spot] })),
  setKind: (key, kind) => set((state) => ({ spots: state.spots.map((spot) => (spot.key === key ? { ...spot, comment: { ...spot.comment, kind } } : spot)) })),
  close: (key) => set((state) => ({ spots: state.spots.filter((spot) => spot.key !== key) })),
}));
