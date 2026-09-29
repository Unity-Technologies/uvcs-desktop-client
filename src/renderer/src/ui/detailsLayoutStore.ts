import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** The changed files pane at the bottom of a details panel: at least this tall once shown, taller when there is room. */
export const CHANGES_HEIGHT = { initial: 320, min: 120, max: 1200 };

interface DetailsLayoutStore {
  changesHeight: number;
  moreDetailsOpen: boolean;
  /** The changed files were hidden with their pane's title: lists already read stay hidden until it shows them again. */
  changesCollapsed: boolean;
  set: (changes: Partial<Pick<DetailsLayoutStore, 'changesHeight' | 'moreDetailsOpen' | 'changesCollapsed'>>) => void;
}

/** How every details panel is laid out, remembered across rows, views and sessions. */
export const useDetailsLayoutStore = create<DetailsLayoutStore>()(
  persist(
    (set) => ({
      changesHeight: CHANGES_HEIGHT.initial,
      moreDetailsOpen: false,
      changesCollapsed: false,
      set,
    }),
    { name: 'details-layout', partialize: ({ set: _set, ...remembered }) => remembered },
  ),
);
