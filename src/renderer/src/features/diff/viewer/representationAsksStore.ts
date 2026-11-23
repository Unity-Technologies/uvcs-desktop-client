import { create } from 'zustand';

interface RepresentationAsks {
  /** The last ask for a view a diff took (`askToTake`), while the window lives. */
  taken: number | null;
  take: (seq: number) => void;
}

/** Which ask for a file's view (a comment gone to) a diff took already, so it's taken once, not at every showing. */
export const useRepresentationAsksStore = create<RepresentationAsks>((set) => ({
  taken: null,
  take: (seq) => set({ taken: seq }),
}));
