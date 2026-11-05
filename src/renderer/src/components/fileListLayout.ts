import { layoutGroupedTree, type GroupedTreeRow } from '../lib/groupedPathTree';
import { layoutPathItems, type ItemOrder } from '../lib/pathTree';
import { fileListGroupsOf, type FileListContent, type GroupedFileListFacts } from './statusGroups';

/** How a list of changed files is shown, as its view menu chose (`useFileListViewStore`). */
export interface FileListView<T> {
  tree: boolean;
  groupByStatus: boolean;
  /** The order of the files when not by path: ranked over the whole list (`useRankedOrder`). */
  order: ItemOrder<T> | undefined;
}

/**
 * Every row of a list of changed files (`useGroupedFileTree`), as if nothing were closed: its groups, with a group per
 * status inside each when asked for (`fileListGroupsOf`), and their files as a list or a tree, in `order`.
 */
export function layoutFileList<T extends { path: string }, G>(content: FileListContent<T, G>, keyOf: (item: T) => string, { tree, groupByStatus, order }: FileListView<T>, facts: GroupedFileListFacts<T, G>): GroupedTreeRow<T, G>[] {
  const groups = fileListGroupsOf(content, groupByStatus, facts);
  if (groups) return layoutGroupedTree(groups, keyOf, tree, order);
  return 'sorted' in content ? layoutPathItems(content.sorted, keyOf, { tree, folderScope: 'all', order }) : [];
}
