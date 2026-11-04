import { useCallback, useMemo } from 'react';
import { collapseGroupedTreeRows, groupedRowsHolding, type GroupedTreeRow } from '../lib/groupedPathTree';
import { rowKeyShowing } from '../lib/pathTree';
import { useCollapsedFolders } from './collapsedFoldersStore';
import { layoutFileList } from './fileListLayout';
import { useFileListViewStore } from './fileListViewStore';
import { useFileTreeFolding, type FileTreeFolding } from './fileTreeFolding';
import type { FileListContent, GroupedFileListFacts } from './statusGroups';
import { useOpenToSelected } from './useOpenToSelected';
import { useRankedOrder } from './useRankedOrder';

export type { FileListContent, GroupedFileListFacts } from './statusGroups';

interface GroupedFileTree<T, G> {
  /** The rows shown, as every list of files shows them (`useFileListViewStore`), closed groups' and folders' contents left out. */
  rows: GroupedTreeRow<T, G>[];
  tree: boolean;
  toggleCollapsed: (key: string) => void;
  /** The key of the row showing an item: its own, or its folder's when the item is a folder holding others. */
  rowKeyOf: (itemKey: string) => string;
  /** Closing or opening all its groups and folders; null for a flat list. */
  folding: FileTreeFolding | null;
}

/**
 * The rows of a list of changed files whose files may be grouped (`useFileTree` for one that never is), as every
 * list shows them: a list or a tree, in the order chosen, and in a group per status when asked for, inside the list's
 * own groups. Items are in `comparePaths` order (`@shared/pathOrder`), `content`, `listed`, `keyOf` and `facts`
 * stable: the rows are laid out again only when the items or the view change. `listed` is every item before the
 * filter, ranked once for the sort (`useRankedOrder`). `scope` names the list, for the groups and folders
 * closed in it (`useCollapsedFolders`); the ones holding `selectedKey` open each time it changes (`useOpenToSelected`).
 */
export function useGroupedFileTree<T extends { path: string }, G>(
  content: FileListContent<T, G>,
  listed: readonly T[],
  keyOf: (item: T) => string,
  scope: string,
  facts: GroupedFileListFacts<T, G>,
  selectedKey?: string | null,
): GroupedFileTree<T, G> {
  const layout = useFileListViewStore((state) => state.layout);
  const groupByStatus = useFileListViewStore((state) => state.groupByStatus);
  const { collapsed, toggleCollapsed, openFolders, closeOnly } = useCollapsedFolders(scope);
  const tree = layout === 'tree';
  const order = useRankedOrder(listed, facts);
  const laidOut = useMemo(() => layoutFileList(content, keyOf, { tree, groupByStatus, order }, facts), [content, keyOf, tree, groupByStatus, order, facts]);
  const rows = useMemo(() => collapseGroupedTreeRows(laidOut, collapsed), [laidOut, collapsed]);
  useOpenToSelected(laidOut, keyOf, groupedRowsHolding, selectedKey, openFolders);
  const rowKeyOf = useCallback((itemKey: string) => rowKeyShowing(laidOut, itemKey, keyOf), [laidOut, keyOf]);
  const folding = useFileTreeFolding(laidOut, rows, closeOnly);
  return { rows, tree, toggleCollapsed, rowKeyOf, folding };
}
