import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ChangesGrouping, ChangesLayout } from './changeRows';

interface PendingChangesViewStore {
  layout: ChangesLayout;
  grouping: ChangesGrouping;
  setLayout: (layout: ChangesLayout) => void;
  setGrouping: (grouping: ChangesGrouping) => void;
}

export const usePendingChangesViewStore = create<PendingChangesViewStore>()(
  persist(
    (set) => ({
      layout: 'list',
      grouping: 'status',
      setLayout: (layout) => set({ layout }),
      setGrouping: (grouping) => set({ grouping }),
    }),
    { name: 'pending-changes-view' },
  ),
);
