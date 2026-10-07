import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface IncomingViewStore {
  /** Whether Incoming's changesets are folded under their header, leaving the files all the room. */
  changesetsCollapsed: boolean;
  toggleChangesets: () => void;
}

/** How Incoming is laid out, kept across sessions: the changesets open at first. */
export const useIncomingViewStore = create<IncomingViewStore>()(
  persist(
    (set) => ({
      changesetsCollapsed: false,
      toggleChangesets: () => set((state) => ({ changesetsCollapsed: !state.changesetsCollapsed })),
    }),
    { name: 'incoming-view', partialize: ({ changesetsCollapsed }) => ({ changesetsCollapsed }) },
  ),
);
