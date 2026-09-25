import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ChangesGrouping, ChangesLayout } from './changeRows';

interface PendingChangesViewStore {
  layout: ChangesLayout;
  grouping: ChangesGrouping;
  setLayout: (layout: ChangesLayout) => void;
  setGrouping: (grouping: ChangesGrouping) => void;
  /** Height of the check-in description, set by dragging the top edge of the check-in panel. */
  descriptionHeight: number;
  setDescriptionHeight: (height: number) => void;
}

export const usePendingChangesViewStore = create<PendingChangesViewStore>()(
  persist(
    (set) => ({
      layout: 'list',
      grouping: 'none',
      setLayout: (layout) => set({ layout }),
      setGrouping: (grouping) => set({ grouping }),
      descriptionHeight: 96,
      setDescriptionHeight: (descriptionHeight) => set({ descriptionHeight }),
    }),
    {
      name: 'pending-changes-view',
      version: 1,
      // Version 0 could group by status, which the status filter chips replaced.
      migrate: (persisted) => ({ ...(persisted as PendingChangesViewStore), grouping: (persisted as PendingChangesViewStore).grouping === 'changelist' ? 'changelist' : 'none' }),
    },
  ),
);
