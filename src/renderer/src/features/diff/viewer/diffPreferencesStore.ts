import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type DiffLayout = 'split' | 'unified';

interface DiffPreferences {
  layout: DiffLayout;
  collapseUnchanged: boolean;
  wrapLines: boolean;
  setLayout: (layout: DiffLayout) => void;
  setCollapseUnchanged: (collapse: boolean) => void;
  setWrapLines: (wrap: boolean) => void;
}

export const useDiffPreferences = create<DiffPreferences>()(
  persist(
    (set) => ({
      layout: 'split',
      collapseUnchanged: true,
      wrapLines: false,
      setLayout: (layout) => set({ layout }),
      setCollapseUnchanged: (collapseUnchanged) => set({ collapseUnchanged }),
      setWrapLines: (wrapLines) => set({ wrapLines }),
    }),
    { name: 'diff-preferences' },
  ),
);
