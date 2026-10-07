import { useCallback, useMemo } from 'react';
import { collapseGroupedTreeRows, groupedRowsHolding, layoutGroupedTree, type GroupedTreeRow, type TreeGroup } from '../lib/groupedPathTree';
import { layoutPathList, layoutPathTree, rowKeyShowing } from '../lib/pathTree';
import { useCollapsedFolders } from './collapsedFoldersStore';
import { useFileListLayoutStore } from './fileListLayoutStore';
import { useOpenToSelected } from './useOpenToSelected';

/** What a list of changed files shows: its items in groups, each with its header, or all of them without any. */
export type FileListContent<T, G> = { groups: readonly TreeGroup<T, G>[] } | { sorted: T[] };

interface GroupedFileTree<T, G> {
  /** The rows shown, as a list or a tree as every list of files is (`useFileListLayoutStore`), closed groups' and folders' contents left out. */
  rows: GroupedTreeRow<T, G>[];
  tree: boolean;
  toggleCollapsed: (key: string) => void;
  /** The key of the row showing an item: its own, or its folder's when the item is a folder holding others. */
  rowKeyOf: (itemKey: string) => string;
}

/**
 * The rows of a list of changed files whose files may be grouped (`useFileTree` for one that never is). Items are in
 * `comparePaths` order (`@shared/pathOrder`), `content` and `keyOf` stable: the rows are laid out again only when the
 * items or the layout change. `scope` names the list, for the groups and folders closed in it (`useCollapsedFolders`);
 * the ones holding `selectedKey` open each time it changes (`useOpenToSelected`).
 */
export function useGroupedFileTree<T extends { path: string }, G>(
  content: FileListContent<T, G>,
  keyOf: (item: T) => string,
  scope: string,
  selectedKey?: string | null,
): GroupedFileTree<T, G> {
  const layout = useFileListLayoutStore((state) => state.layout);
  const { collapsed, toggleCollapsed, openFolders } = useCollapsedFolders(scope);
  const tree = layout === 'tree';
  const laidOut = useMemo<GroupedTreeRow<T, G>[]>(() => {
    if ('groups' in content) return layoutGroupedTree(content.groups, keyOf, tree);
    return tree ? layoutPathTree({ sorted: content.sorted, keyOf, folderScope: 'all' }) : layoutPathList(content.sorted, keyOf);
  }, [content, keyOf, tree]);
  const rows = useMemo(() => collapseGroupedTreeRows(laidOut, collapsed), [laidOut, collapsed]);
  useOpenToSelected(laidOut, keyOf, groupedRowsHolding, selectedKey, openFolders);
  const rowKeyOf = useCallback((itemKey: string) => rowKeyShowing(laidOut, itemKey, keyOf), [laidOut, keyOf]);
  return { rows, tree, toggleCollapsed, rowKeyOf };
}
