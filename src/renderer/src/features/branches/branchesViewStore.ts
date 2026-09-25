import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SincePreset } from '../../lib/sincePresets';

export type BranchesLayout = 'list' | 'tree';

interface BranchesViewStore {
  layout: BranchesLayout;
  since: SincePreset;
  onlyMine: boolean;
  showHidden: boolean;
  update: (changes: Partial<Omit<BranchesViewStore, 'update'>>) => void;
}

export const useBranchesViewStore = create<BranchesViewStore>()(
  persist(
    (set) => ({
      layout: 'list',
      since: 'anyTime',
      onlyMine: false,
      showHidden: false,
      update: (changes) => set(changes),
    }),
    { name: 'branches-view' },
  ),
);
