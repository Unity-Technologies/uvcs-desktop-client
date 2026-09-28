import { create } from 'zustand';
import type { FileView } from '../annotate/fileView';

interface FilesViewStore {
  /** What the selected file shows: its comparison (`itemComparison`), or its annotations. Kept as the selection moves. */
  fileView: FileView;
  /** A path to select and scroll to, e.g. after creating or renaming an item, with the others to select (moved items). */
  revealRequest: { path: string; selected?: string[] } | null;
  setFileView: (view: FileView) => void;
  requestReveal: (path: string, selected?: string[]) => void;
}

export const useFilesViewStore = create<FilesViewStore>((set) => ({
  fileView: 'diff',
  revealRequest: null,
  setFileView: (fileView) => set({ fileView }),
  requestReveal: (path, selected) => set({ revealRequest: { path, selected } }),
}));
