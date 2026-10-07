import { useMemo } from 'react';
import { collapseGroupedTreeRows, layoutGroupedTree, type GroupedTreeRow, type TreeGroup } from '../lib/groupedPathTree';
import { layoutPathList, layoutPathTree } from '../lib/pathTree';
import { useCollapsedFolders } from './collapsedFoldersStore';
import { useFileListLayoutStore } from './fileListLayoutStore';

/** What a list of changed files shows: its items in groups, each with its header, or all of them without any. */
export type FileListContent<T, G> = { groups: readonly TreeGroup<T, G>[] } | { sorted: T[] };

interface GroupedFileTree<T, G> {
  /** The rows shown, as a list or a tree as every list of files is (`useFileListLayoutStore`), closed groups' and folders' contents left out. */
  rows: GroupedTreeRow<T, G>[];
  tree: boolean;
  toggleCollapsed: (key: string) => void;
}

/**
 * The rows of a list of changed files whose files may be grouped (`useFileTree` for one that never is). Items are in
 * `comparePaths` order (`@shared/pathOrder`), `content` and `keyOf` stable: the rows are laid out again only when the
 * items or the layout change. `scope` names the list, for the groups and folders closed in it (`useCollapsedFolders`).
 */
export function useGroupedFileTree<T extends { path: string }, G>(content: FileListContent<T, G>, keyOf: (item: T) => string, scope: string): GroupedFileTree<T, G> {
  const layout = useFileListLayoutStore((state) => state.layout);
  const { collapsed, toggleCollapsed } = useCollapsedFolders(scope);
  const tree = layout === 'tree';
  const laidOut = useMemo<GroupedTreeRow<T, G>[]>(() => {
    if ('groups' in content) return layoutGroupedTree(content.groups, keyOf, tree);
    return tree ? layoutPathTree({ sorted: content.sorted, keyOf, folderScope: 'all' }) : layoutPathList(content.sorted, keyOf);
  }, [content, keyOf, tree]);
  const rows = useMemo(() => collapseGroupedTreeRows(laidOut, collapsed), [laidOut, collapsed]);
  return { rows, tree, toggleCollapsed };
}
