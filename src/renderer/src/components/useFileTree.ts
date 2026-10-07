import { useMemo } from 'react';
import { collapseTreeRows, layoutPathList, layoutPathTree, type PathTreeRow } from '../lib/pathTree';
import { useCollapsedFolders } from './collapsedFoldersStore';
import { useFileListLayoutStore } from './fileListLayoutStore';

interface FileTree<T> {
  /** The rows shown, as a list or a tree as every list of files is (`useFileListLayoutStore`), closed folders' contents left out. */
  rows: PathTreeRow<T>[];
  tree: boolean;
  toggleCollapsed: (key: string) => void;
}

const depthOf = <T>(row: PathTreeRow<T>): number => row.depth;

/**
 * The rows of a list of changed files. `sorted` is in `comparePaths` order (`@shared/pathOrder`), and `keyOf` stable:
 * the rows are laid out again only when the items or the layout change. `scope` names the list, for the folders
 * closed in it (`useCollapsedFolders`).
 */
export function useFileTree<T extends { path: string }>(sorted: T[], keyOf: (item: T) => string, scope: string): FileTree<T> {
  const layout = useFileListLayoutStore((state) => state.layout);
  const { collapsed, toggleCollapsed } = useCollapsedFolders(scope);
  const laidOut = useMemo<PathTreeRow<T>[]>(
    () => (layout === 'tree' ? layoutPathTree({ sorted, keyOf, folderScope: 'all' }) : layoutPathList(sorted, keyOf)),
    [sorted, keyOf, layout],
  );
  const rows = useMemo(() => collapseTreeRows(laidOut, collapsed, depthOf), [laidOut, collapsed]);
  return { rows, tree: layout === 'tree', toggleCollapsed };
}
