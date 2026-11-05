import { groupedRowLevel, groupedTreeArrowRows, groupLevelsOf, hasChevronColumn } from '../../lib/groupedPathTree';
import type { TreeArrowRow } from '../../lib/treeArrowMove';
import type { ChangeRow } from './changeRows';

/**
 * One level of depth: a checkbox and the gap after it, which is also the room a chevron takes (icon, its margins and the
 * gap). A changelist's or a folder's chevron sits in a column of its own, and what it holds starts a level in: its
 * rows' chevron column under its checkbox, their checkboxes under its icon.
 */
export const LEVEL_INDENT = 21;

/** How the rows of one layout sit: the same for every row, worked out once per layout (`rowLevelsOf`). */
export interface RowLevels {
  /** How many groups every change sits in (`groupLevelsOf`): changelists, status groups, or both. */
  groupLevels: number;
  /**
   * Whether the rows leave a column for the chevrons of the changelists and folders, so a file's checkbox lines up
   * with its sibling folders' and not with their chevrons. Only a flat list without groups has none: its rows stay flush.
   */
  chevronColumn: boolean;
}

/** How the rows sit: in a tree, or once grouped, every row leaves the chevron's column, even while no folder shows. */
export function rowLevelsOf(rows: readonly ChangeRow[], tree: boolean): RowLevels {
  const groupLevels = groupLevelsOf(rows);
  return { groupLevels, chevronColumn: hasChevronColumn(groupLevels, tree) };
}

/** How many changelists, status groups and folders hold the row: the indent guides it draws, one under each one's chevron. */
export function rowLevel(row: ChangeRow, { groupLevels }: RowLevels): number {
  return groupedRowLevel(row, groupLevels);
}

/** How far a row's content starts from the left edge: a level per what holds it, and a file past the chevron column. */
export function rowIndent(row: ChangeRow, levels: RowLevels): number {
  const chevronRoom = row.type === 'file' && levels.chevronColumn ? 1 : 0;
  return (rowLevel(row, levels) + chevronRoom) * LEVEL_INDENT;
}

/** The row's level in the tree screen readers are told about: changelists first, then status groups, folders, files. */
export function treeLevel(row: ChangeRow, levels: RowLevels): number {
  return rowLevel(row, levels) + 1;
}

/** The rows as ← and → see them (`treeArrowMove`): changelists, status groups and folders open and close. */
export function changeTreeArrowRows(rows: readonly ChangeRow[]): TreeArrowRow[] {
  return groupedTreeArrowRows(rows);
}

/** Where the top-level checkboxes are, which the summary's checkbox for every change lines up with. */
export function topLevelCheckboxInset({ chevronColumn }: RowLevels): number {
  return chevronColumn ? LEVEL_INDENT : 0;
}
