import { create } from 'zustand';

export type DetailsTab = 'details' | 'changes';

interface FilesViewStore {
  detailsTab: DetailsTab;
  /** A path to select and scroll to, e.g. after creating or renaming an item, with the others to select (moved items). */
  revealRequest: { path: string; selected?: string[] } | null;
  setDetailsTab: (tab: DetailsTab) => void;
  requestReveal: (path: string, selected?: string[]) => void;
}

export const useFilesViewStore = create<FilesViewStore>((set) => ({
  detailsTab: 'details',
  revealRequest: null,
  setDetailsTab: (detailsTab) => set({ detailsTab }),
  requestReveal: (path, selected) => set({ revealRequest: { path, selected } }),
}));
