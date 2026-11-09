import { useCallback, useMemo } from 'react';
import { collapseTreeRows, layoutPathItems, rowKeyShowing, rowsHolding, type PathTreeRow } from '../lib/pathTree';
import { useCollapsedFolders } from './collapsedFoldersStore';
import type { FileListFacts } from './fileListOrder';
import { useFileListViewStore } from './fileListViewStore';
import { useOpenToSelected } from './useOpenToSelected';
import { useRankedOrder } from './useRankedOrder';

interface FileTree<T> {
  /** The rows shown, as a list or a tree in the order every list of files has (`useFileListViewStore`), closed folders' contents left out. */
  rows: PathTreeRow<T>[];
  tree: boolean;
  toggleCollapsed: (key: string) => void;
  /** The key of the row showing an item: its own, or its folder's when the item is a folder holding others. */
  rowKeyOf: (itemKey: string) => string;
}

const depthOf = <T>(row: PathTreeRow<T>): number => row.depth;
const holdingRow = <T>(rows: readonly PathTreeRow<T>[], key: string): string[] => rowsHolding(rows, key, depthOf);

/**
 * The rows of a short list of changed files that is never grouped (a details panel's: `useGroupedFileTree` for the
 * others), as a list or a tree in the order chosen. `sorted` is in `comparePaths` order (`@shared/pathOrder`), `keyOf`
 * and `facts` stable: the rows are laid out again only when the items or the view change. `listed` is every item
 * before the filter, ranked once for the sort (`useRankedOrder`). `scope` names the list, for the folders closed in it
 * (`useCollapsedFolders`). The folders holding `selectedKey` open each time it changes (`useOpenToSelected`).
 */
export function useFileTree<T extends { path: string }>(sorted: T[], listed: readonly T[], keyOf: (item: T) => string, scope: string, facts: FileListFacts<T>, selectedKey?: string | null): FileTree<T> {
  const layout = useFileListViewStore((state) => state.layout);
  const { collapsed, toggleCollapsed, openFolders } = useCollapsedFolders(scope);
  const order = useRankedOrder(listed, facts);
  const laidOut = useMemo<PathTreeRow<T>[]>(() => layoutPathItems(sorted, keyOf, { tree: layout === 'tree', folderScope: 'all', order }), [sorted, keyOf, layout, order]);
  const rows = useMemo(() => collapseTreeRows(laidOut, collapsed, depthOf), [laidOut, collapsed]);
  useOpenToSelected(laidOut, keyOf, holdingRow, selectedKey, openFolders);
  const rowKeyOf = useCallback((itemKey: string) => rowKeyShowing(laidOut, itemKey, keyOf), [laidOut, keyOf]);
  return { rows, tree: layout === 'tree', toggleCollapsed, rowKeyOf };
}
