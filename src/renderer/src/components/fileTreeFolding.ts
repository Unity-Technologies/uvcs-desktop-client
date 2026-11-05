import { createContext, useMemo } from 'react';

/** Closing or opening every group and folder of a list of files at once (`FileListViewMenu`). */
export interface FileTreeFolding {
  /** Whether some group or folder shows what it holds: what closing all would close. */
  anyOpen: boolean;
  collapseAll: () => void;
  expandAll: () => void;
}

/** A row of a list of files as folding sees it: groups and folders can close, files can't. */
interface FoldableRow {
  type: string;
  key: string;
  collapsed?: boolean;
}

/**
 * How a list folds, from its rows laid out as if nothing were closed (`laidOut`) and the rows shown: null when it has
 * no group or folder to fold (a flat list). `closeOnly` closes exactly the keys it is given (`useCollapsedFolders`).
 */
export function fileTreeFoldingOf(laidOut: readonly FoldableRow[], shown: readonly FoldableRow[], closeOnly: (keys: readonly string[]) => void): FileTreeFolding | null {
  if (!laidOut.some((row) => row.type !== 'file')) return null;
  return {
    anyOpen: shown.some((row) => row.type !== 'file' && !row.collapsed),
    // Worked out when asked for: a list of a million changes is laid out again on every folder opened.
    collapseAll: () => closeOnly(laidOut.filter((row) => row.type !== 'file').map((row) => row.key)),
    expandAll: () => closeOnly([]),
  };
}

/** `fileTreeFoldingOf`, worked out again only when the rows change. */
export function useFileTreeFolding(laidOut: readonly FoldableRow[], shown: readonly FoldableRow[], closeOnly: (keys: readonly string[]) => void): FileTreeFolding | null {
  return useMemo(() => fileTreeFoldingOf(laidOut, shown, closeOnly), [laidOut, shown, closeOnly]);
}

/**
 * The folding of the list a filter bar is over: the bar's view menu (`FileListViewMenu`) offers it. Given by the list
 * around its toolbar, since the bar is made before the rows it filters are laid out.
 */
export const FileTreeFoldingContext = createContext<FileTreeFolding | null>(null);
