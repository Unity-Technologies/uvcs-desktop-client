import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ChangesGrouping } from './changeRows';

/** How the Changes view shows its list; its layout, list or tree, is every list of files' (`useFileListLayoutStore`). */
interface PendingChangesViewStore {
  grouping: ChangesGrouping;
  setGrouping: (grouping: ChangesGrouping) => void;
  /** Height of the check-in description, set by dragging the top edge of the check-in panel. */
  descriptionHeight: number;
  setDescriptionHeight: (height: number) => void;
}

export const usePendingChangesViewStore = create<PendingChangesViewStore>()(
  persist(
    (set) => ({
      grouping: 'none',
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
