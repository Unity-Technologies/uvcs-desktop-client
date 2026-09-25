import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type DiffLayout = 'split' | 'unified';

interface DiffPreferences {
  layout: DiffLayout;
  collapseUnchanged: boolean;
  setLayout: (layout: DiffLayout) => void;
  setCollapseUnchanged: (collapse: boolean) => void;
}

export const useDiffPreferences = create<DiffPreferences>()(
  persist(
    (set) => ({
      layout: 'split',
      collapseUnchanged: true,
      setLayout: (layout) => set({ layout }),
      setCollapseUnchanged: (collapseUnchanged) => set({ collapseUnchanged }),
    }),
    { name: 'diff-preferences' },
  ),
);
