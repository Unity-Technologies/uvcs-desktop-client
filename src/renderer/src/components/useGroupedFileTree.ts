import { useCallback, useMemo } from 'react';
import { collapseGroupedTreeRows, groupedRowsHolding, layoutGroupedTree, type GroupedTreeRow } from '../lib/groupedPathTree';
import { layoutPathItems, rowKeyShowing } from '../lib/pathTree';
import { useCollapsedFolders } from './collapsedFoldersStore';
import { fileListOrder } from './fileListOrder';
import { useFileListViewStore } from './fileListViewStore';
import { useFileTreeFolding, type FileTreeFolding } from './fileTreeFolding';
import { withStatusGroups, type FileListContent, type GroupedFileListFacts } from './statusGroups';
import { useOpenToSelected } from './useOpenToSelected';

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
 * own groups. Items are in `comparePaths` order (`@shared/pathOrder`), `content`, `keyOf` and `facts` stable: the rows
 * are laid out again only when the items or the view change. `scope` names the list, for the groups and folders
 * closed in it (`useCollapsedFolders`); the ones holding `selectedKey` open each time it changes (`useOpenToSelected`).
 */
export function useGroupedFileTree<T extends { path: string }, G>(
  content: FileListContent<T, G>,
  keyOf: (item: T) => string,
  scope: string,
  facts: GroupedFileListFacts<T, G>,
  selectedKey?: string | null,
): GroupedFileTree<T, G> {
  const { layout, sort, groupByStatus } = useFileListViewStore();
  const { collapsed, toggleCollapsed, openFolders, closeOnly } = useCollapsedFolders(scope);
  const tree = layout === 'tree';
  const byStatus = groupByStatus && facts.statusGroup !== undefined;
  const laidOut = useMemo<GroupedTreeRow<T, G>[]>(() => {
    const order = fileListOrder(sort, facts);
    const groups = byStatus ? withStatusGroups(content, facts) : 'groups' in content ? content.groups : null;
    if (groups) return layoutGroupedTree(groups, keyOf, tree, order);
    return layoutPathItems((content as { sorted: T[] }).sorted, keyOf, { tree, folderScope: 'all', order });
  }, [content, keyOf, tree, sort, byStatus, facts]);
  const rows = useMemo(() => collapseGroupedTreeRows(laidOut, collapsed), [laidOut, collapsed]);
  useOpenToSelected(laidOut, keyOf, groupedRowsHolding, selectedKey, openFolders);
  const rowKeyOf = useCallback((itemKey: string) => rowKeyShowing(laidOut, itemKey, keyOf), [laidOut, keyOf]);
  const folding = useFileTreeFolding(laidOut, rows, closeOnly);
  return { rows, tree, toggleCollapsed, rowKeyOf, folding };
}
