import { create } from 'zustand';
import type { LineCommentKind } from '@shared/domain/reviewConversation';
import type { NewLineCommentSpot } from './newLineComment';

interface NewLineComments {
  /** The comments being written on lines, in every review of the window, oldest first. */
  spots: NewLineCommentSpot[];
  /**
   * The comment to focus, each time it's opened (`seq`): only then. A comment kept while its file wasn't shown mounts
   * again as the file shows, and taking the focus then would pull it from the list of files the user is going through.
   */
  focusRequest: { key: string; seq: number } | null;
  /** The last request's `seq`, never repeated: a request made again is told apart from one already taken. */
  focusSeq: number;
  /** Starts a comment on a line, focused; one already started there stays as it is, its kind and text kept, and is focused. */
  open: (spot: NewLineCommentSpot) => void;
  /** The comment asked to focus took it: it's not asked again as it mounts again. */
  focusTaken: (seq: number) => void;
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
  focusRequest: null,
  focusSeq: 0,
  open: (spot) =>
    set((state) => ({
      spots: state.spots.some((open) => open.key === spot.key) ? state.spots : [...state.spots, spot],
      focusRequest: { key: spot.key, seq: state.focusSeq + 1 },
      focusSeq: state.focusSeq + 1,
    })),
  focusTaken: (seq) => set((state) => (state.focusRequest?.seq === seq ? { focusRequest: null } : state)),
  setKind: (key, kind) => set((state) => ({ spots: state.spots.map((spot) => (spot.key === key ? { ...spot, comment: { ...spot.comment, kind } } : spot)) })),
  close: (key) => set((state) => ({ spots: state.spots.filter((spot) => spot.key !== key) })),
}));
