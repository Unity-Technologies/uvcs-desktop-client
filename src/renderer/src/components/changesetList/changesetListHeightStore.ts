import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ChangesetListHeightStore {
  /** The height the user dragged the changesets' rows to, or null for each list's own (`mostRows`). */
  rowsHeight: number | null;
  setRowsHeight: (rowsHeight: number | null) => void;
}

/**
 * How tall the user made the changesets above the files (`ChangesetStepList`), one height for every list of them (a
 * branch's diff, a code review, Incoming), remembered across pages and sessions.
 */
export const useChangesetListHeightStore = create<ChangesetListHeightStore>()(
  persist(
    (set) => ({
      rowsHeight: null,
      setRowsHeight: (rowsHeight) => set({ rowsHeight }),
    }),
    { name: 'changeset-list-height', partialize: ({ rowsHeight }) => ({ rowsHeight }) },
  ),
);
