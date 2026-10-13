import { create } from 'zustand';
import type { FileView } from '../annotate/fileView';

/** A path to select and scroll to in one workspace's tree, with the others to select (moved items). */
export interface RevealRequest {
  workspacePath: string;
  path: string;
  selected?: string[];
}

interface FilesViewStore {
  /** What the selected file shows: its comparison (`itemComparison`), or its annotations. Kept as the selection moves. */
  fileView: FileView;
  /** The reveal the Files view takes next, e.g. after creating or renaming an item; `revealed` once done. */
  revealRequest: RevealRequest | null;
  setFileView: (view: FileView) => void;
  requestReveal: (workspacePath: string, path: string, selected?: string[]) => void;
  /** Forgets the request once revealed; a newer one, asked meanwhile, stays for the view to take next. */
  revealed: (request: RevealRequest) => void;
}

export const useFilesViewStore = create<FilesViewStore>((set) => ({
  fileView: 'diff',
  revealRequest: null,
  setFileView: (fileView) => set({ fileView }),
  requestReveal: (workspacePath, path, selected) => set({ revealRequest: { workspacePath, path, selected } }),
  revealed: (request) => set((state) => (state.revealRequest === request ? { revealRequest: null } : state)),
}));

/**
 * The reveal for this workspace's tree: none while it was asked in another, whose folders this tree would list
 * (expanding them runs a `cm ls` of a path the workspace doesn't have).
 */
export function revealRequestIn(state: Pick<FilesViewStore, 'revealRequest'>, workspacePath: string): RevealRequest | null {
  return state.revealRequest?.workspacePath === workspacePath ? state.revealRequest : null;
}
