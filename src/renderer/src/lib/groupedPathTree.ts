import { collapseTreeRows, layoutPathList, layoutPathTree, rowsHolding, type PathTreeRow, type TreeFolderRow } from './pathTree';
import { treeArrowMove, type TreeArrowMove, type TreeArrowRow } from './treeArrowMove';

/**
 * A group of a list of changed files, e.g. a changelist, or a merge's conflicts: its header row, with the items it
 * holds laid out after it as the list is (a list or a tree). `group` is what the list knows it by (the changelist).
 */
export interface TreeGroupRow<T, G> {
  type: 'group';
  key: string;
  label: string;
  group: G;
  /** Every item in the group, in order. */
  items: T[];
  collapsed: boolean;
}

/** A group, a folder or a file of a list of changed files whose files are grouped. */
export type GroupedTreeRow<T, G> = TreeGroupRow<T, G> | PathTreeRow<T>;

export interface TreeGroup<T, G> {
  /** Unique in the list: it keys the group's row and the rows of its folders (`folder:<key>:<path>`). */
  key: string;
  label: string;
  group: G;
  /** The group's items, sorted by `comparePaths` (`@shared/pathOrder`). */
  sorted: T[];
}

/**
 * The rows of a list grouped into `groups`: each group's header, then its items as a list or a tree. Every row, as if
 * nothing was collapsed: closing a group or a folder only leaves rows out (`collapseGroupedTreeRows`).
 */
export function layoutGroupedTree<T extends { path: string }, G>(groups: readonly TreeGroup<T, G>[], keyOf: (item: T) => string, tree: boolean): GroupedTreeRow<T, G>[] {
  const rows: GroupedTreeRow<T, G>[] = [];
  for (const { key, label, group, sorted } of groups) {
    rows.push({ type: 'group', key, label, group, items: sorted, collapsed: false });
    const laidOut = tree ? layoutPathTree({ sorted, keyOf, folderScope: key }) : layoutPathList(sorted, keyOf);
    // One at a time: spreading 100,000 rows into `push` passes more arguments than a call takes.
    for (const row of laidOut) rows.push(row);
  }
  return rows;
}

/** A row that holds others: a group or a folder. */
export function isHeaderRow<T, G>(row: GroupedTreeRow<T, G>): row is TreeGroupRow<T, G> | TreeFolderRow<T> {
  return row.type !== 'file';
}

/** Whether the rows are grouped: groups, when there are any, lead them. */
export function isGroupedList<T, G>(rows: readonly GroupedTreeRow<T, G>[]): boolean {
  return rows[0]?.type === 'group';
}

/** How many levels in a row sits: groups at the top, then what they hold, folder by folder (a row's `depth`). */
export function groupedRowLevel<T, G>(row: GroupedTreeRow<T, G>, grouped: boolean): number {
  if (row.type === 'group') return 0;
  return row.depth + (grouped ? 1 : 0);
}

/** The rows laid out by `layoutGroupedTree` (or `layoutPathTree`) but for what closed groups and folders hold. */
export function collapseGroupedTreeRows<T, G>(rows: GroupedTreeRow<T, G>[], collapsed: ReadonlySet<string>): GroupedTreeRow<T, G>[] {
  const grouped = isGroupedList(rows);
  return collapseTreeRows(rows, collapsed, (row) => groupedRowLevel(row, grouped));
}

/** The rows as ← and → see them (`treeArrowMove`): groups and folders open and close. */
export function groupedTreeArrowRows<T, G>(rows: readonly GroupedTreeRow<T, G>[]): TreeArrowRow[] {
  const grouped = isGroupedList(rows);
  return rows.map((row) => ({ depth: groupedRowLevel(row, grouped), isFolder: row.type !== 'file', isExpanded: row.type !== 'file' && !row.collapsed }));
}

/** What a key does on the row at `index`: ← and → as in any tree (`treeArrowMove`), Enter opens or closes a group or a folder. */
export function groupedTreeKeyMove<T, G>(rows: readonly GroupedTreeRow<T, G>[], index: number, key: string): TreeArrowMove | null {
  if (key === 'Enter') return rows[index] && rows[index].type !== 'file' ? { kind: 'toggle' } : null;
  if (key !== 'ArrowLeft' && key !== 'ArrowRight') return null;
  return treeArrowMove(groupedTreeArrowRows(rows), index, key);
}

/** The folders, then the group, holding the row keyed `key`, as `rowsHolding` finds them: opening them shows it. */
export function groupedRowsHolding<T, G>(rows: readonly GroupedTreeRow<T, G>[], key: string): string[] {
  const grouped = isGroupedList(rows);
  return rowsHolding(rows, key, (row) => groupedRowLevel(row, grouped));
}
