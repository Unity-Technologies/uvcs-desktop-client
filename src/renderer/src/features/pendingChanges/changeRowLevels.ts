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
  if (row.type === 'group') return 0;
  return (row.depth + (grouped ? 1 : 0)) * LEVEL_INDENT;
}

/** The row's level in the tree screen readers are told about: changelists first, then folders, then files. */
export function treeLevel(row: ChangeRow, grouped: boolean): number {
  if (row.type === 'group') return 1;
  return row.depth + (grouped ? 2 : 1);
}

/** The rows as ← and → see them (`treeArrowMove`): changelists and folders open and close. */
export function changeTreeArrowRows(rows: readonly ChangeRow[]): TreeArrowRow[] {
  const grouped = rows.some((row) => row.type === 'group');
  return rows.map((row) => ({ depth: treeLevel(row, grouped), isFolder: row.type !== 'change', isExpanded: row.type !== 'change' && !row.collapsed }));
}

/** Changelist headers lead the rows: the top-level checkboxes are theirs, after their chevrons. */
export function topLevelCheckboxInset(rows: ChangeRow[]): number {
  return rows.some((row) => row.type === 'group') ? LEVEL_INDENT : 0;
}
