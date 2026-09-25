import { create } from 'zustand';

interface ExpandedDirectoriesStore {
  /** Expanded directory paths per tree (a workspace path, or a repository tree id). */
  expandedByTree: Record<string, ReadonlySet<string>>;
  toggle: (treeId: string, directory: string) => void;
  expand: (treeId: string, directories: string[]) => void;
}

const NONE: ReadonlySet<string> = new Set();

/** Remembers which folders are open, so leaving and coming back to a tree keeps its shape. */
export const useExpandedDirectoriesStore = create<ExpandedDirectoriesStore>((set) => ({
  expandedByTree: {},
  toggle: (treeId, directory) =>
    set((state) => {
      const expanded = new Set(state.expandedByTree[treeId] ?? NONE);
      if (expanded.has(directory)) expanded.delete(directory);
      else expanded.add(directory);
      return { expandedByTree: { ...state.expandedByTree, [treeId]: expanded } };
    }),
  expand: (treeId, directories) =>
    set((state) => ({
      expandedByTree: { ...state.expandedByTree, [treeId]: new Set([...(state.expandedByTree[treeId] ?? NONE), ...directories]) },
    })),
}));

export function useExpandedDirectories(treeId: string): ReadonlySet<string> {
  return useExpandedDirectoriesStore((state) => state.expandedByTree[treeId] ?? NONE);
}
