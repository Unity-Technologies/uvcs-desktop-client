import { useCallback, useMemo } from 'react';
import { collapseTreeRows, layoutPathList, layoutPathTree, rowKeyShowing, rowsHolding, type PathTreeRow } from '../lib/pathTree';
import { useCollapsedFolders } from './collapsedFoldersStore';
import { useFileListLayoutStore } from './fileListLayoutStore';
import { useOpenToSelected } from './useOpenToSelected';

interface FileTree<T> {
  /** The rows shown, as a list or a tree as every list of files is (`useFileListLayoutStore`), closed folders' contents left out. */
  rows: PathTreeRow<T>[];
  tree: boolean;
  toggleCollapsed: (key: string) => void;
  /** The key of the row showing an item: its own, or its folder's when the item is a folder holding others. */
  rowKeyOf: (itemKey: string) => string;
}

const depthOf = <T>(row: PathTreeRow<T>): number => row.depth;
const holdingRow = <T>(rows: readonly PathTreeRow<T>[], key: string): string[] => rowsHolding(rows, key, depthOf);

/**
 * The rows of a list of changed files. `sorted` is in `comparePaths` order (`@shared/pathOrder`), and `keyOf` stable:
 * the rows are laid out again only when the items or the layout change. `scope` names the list, for the folders
 * closed in it (`useCollapsedFolders`). The folders holding `selectedKey` open each time it changes (`useOpenToSelected`).
 */
export function useFileTree<T extends { path: string }>(sorted: T[], keyOf: (item: T) => string, scope: string, selectedKey?: string | null): FileTree<T> {
  const layout = useFileListLayoutStore((state) => state.layout);
  const { collapsed, toggleCollapsed, openFolders } = useCollapsedFolders(scope);
  const laidOut = useMemo<PathTreeRow<T>[]>(
    () => (layout === 'tree' ? layoutPathTree({ sorted, keyOf, folderScope: 'all' }) : layoutPathList(sorted, keyOf)),
    [sorted, keyOf, layout],
  );
  const rows = useMemo(() => collapseTreeRows(laidOut, collapsed, depthOf), [laidOut, collapsed]);
  useOpenToSelected(laidOut, keyOf, holdingRow, selectedKey, openFolders);
  const rowKeyOf = useCallback((itemKey: string) => rowKeyShowing(laidOut, itemKey, keyOf), [laidOut, keyOf]);
  return { rows, tree: layout === 'tree', toggleCollapsed, rowKeyOf };
}
