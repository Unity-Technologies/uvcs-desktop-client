import { groupedRowLevel, groupedTreeArrowRows, isGroupedList } from '../../lib/groupedPathTree';
import type { TreeArrowRow } from '../../lib/treeArrowMove';
import type { ChangeRow } from './changeRows';

/**
 * One level of depth: a checkbox and the gap after it, which is also the room a chevron takes (icon, its margins and the
 * gap). A folder's chevron sits in its siblings' checkbox column, so its checkbox lines up with their status badges and
 * its children's checkboxes line up under its own.
 */
export const LEVEL_INDENT = 21;

/**
 * How far a row's content starts from the left edge. Top-level files stay flush whether the list is flat or a tree;
 * everything inside a folder or a changelist is one level right of it.
 */
export function rowIndent(row: ChangeRow, grouped: boolean): number {
  return groupedRowLevel(row, grouped) * LEVEL_INDENT;
}

/** The row's level in the tree screen readers are told about: changelists first, then folders, then files. */
export function treeLevel(row: ChangeRow, grouped: boolean): number {
  return groupedRowLevel(row, grouped) + 1;
}

/** The rows as ← and → see them (`treeArrowMove`): changelists and folders open and close. */
export function changeTreeArrowRows(rows: readonly ChangeRow[]): TreeArrowRow[] {
  return groupedTreeArrowRows(rows);
}

/** Changelist headers lead the rows: the top-level checkboxes are theirs, after their chevrons. */
export function topLevelCheckboxInset(rows: ChangeRow[]): number {
  return isGroupedList(rows) ? LEVEL_INDENT : 0;
}
