import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ChangesLayout } from './changeRows';

interface PendingChangesViewStore {
  layout: ChangesLayout;
  setLayout: (layout: ChangesLayout) => void;
}

export const usePendingChangesViewStore = create<PendingChangesViewStore>()(
  persist((set) => ({ layout: 'list', setLayout: (layout) => set({ layout }) }), { name: 'pending-changes-view' }),
);
