import { create } from 'zustand';

export type DetailsTab = 'details' | 'changes';

interface FilesViewStore {
  detailsTab: DetailsTab;
  /** A path to select and scroll to, e.g. after creating or renaming an item. */
  revealRequest: { path: string } | null;
  setDetailsTab: (tab: DetailsTab) => void;
  requestReveal: (path: string) => void;
}

export const useFilesViewStore = create<FilesViewStore>((set) => ({
  detailsTab: 'details',
  revealRequest: null,
  setDetailsTab: (detailsTab) => set({ detailsTab }),
  requestReveal: (path) => set({ revealRequest: { path } }),
}));
