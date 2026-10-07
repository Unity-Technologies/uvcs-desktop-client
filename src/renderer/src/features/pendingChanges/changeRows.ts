import type { Changelist, PendingChange } from '@shared/domain/pendingChanges';
import type { FileListLayout } from '../../components/fileListLayoutStore';
import { collapseTreeRows, layoutPathList, layoutPathTree, type PathTreeRow } from '../../lib/pathTree';
import { sortChanges } from './changeOrder';
import { treeLevel } from './changeRowLevels';

/** A changelist header. */
interface GroupRow {
  type: 'group';
  key: string;
  label: string;
  /** Set when the group is a user changelist. */
  changelist?: Changelist;
  items: PendingChange[];
  collapsed: boolean;
}

/** A changelist, a folder of changes or a change: folders and changes are the rows of every tree of files (`pathTree`). */
export type ChangeRow = GroupRow | PathTreeRow<PendingChange>;

export type ChangesGrouping = 'none' | 'changelist';

export const DEFAULT_CHANGELIST_LABEL = 'Default changelist';

interface LayoutInput {
  changes: PendingChange[];
  changelists: Changelist[];
  layout: FileListLayout;
  grouping: ChangesGrouping;
}

interface Group {
  key: string;
  label: string;
  changelist?: Changelist;
  changes: PendingChange[];
}

/**
 * Flattens pending changes into the rows of the list: changelist headers, optional folders and changes. Every row, as
 * if nothing was collapsed: opening or closing a folder only leaves rows out (`collapseRows`). What is checked is left
 * to `rowCheckState`: checking files doesn't lay tens of thousands of rows out again either.
 */
export function layoutChangeRows({ changes, changelists, layout, grouping }: LayoutInput): ChangeRow[] {
  const rows: ChangeRow[] = [];
  if (grouping === 'none') {
    appendChangeRows(rows, changes, 'all', layout);
    return rows;
  }

  for (const group of groupByChangelist(changes, changelists)) {
    const sorted = sortChanges(group.changes);
    rows.push({
      type: 'group',
      key: group.key,
      label: group.label,
      changelist: group.changelist,
      items: sorted,
      collapsed: false,
    });
    appendChangeRows(rows, sorted, group.key, layout);
  }
  return rows;
}

/** The rows laid out by `layoutChangeRows` but for what collapsed changelists and folders hold. */
export function collapseRows(rows: ChangeRow[], collapsed: ReadonlySet<string>): ChangeRow[] {
  // Changelists, when there are any, lead the rows.
  const grouped = rows[0]?.type === 'group';
  return collapseTreeRows(rows, collapsed, (row) => treeLevel(row, grouped));
}

/** Kept per change: lists of tens of thousands of rows look keys up in maps and sets, which hash each new string again. */
const changeKeys = new WeakMap<PendingChange, string>();

export function changeKey(change: PendingChange): string {
  let key = changeKeys.get(change);
  if (key === undefined) {
    key = `change:${change.path}`;
    changeKeys.set(change, key);
  }
  return key;
}

/** The changes a row stands for: all changes in a group or folder, or the change itself. */
export function changesUnderRow(row: ChangeRow): PendingChange[] {
  return row.type === 'file' ? [row.item] : row.items;
}

/** What the menu of a right-clicked row is for: a changelist, the changes in a folder or the default changelist, or the selected files (null). */
export function menuTargetOf(row: ChangeRow | null): Changelist | PendingChange[] | null {
  if (!row || row.type === 'file') return null;
  return row.type === 'group' && row.changelist ? row.changelist : row.items;
}

function appendChangeRows(rows: ChangeRow[], changes: PendingChange[], groupKey: string, layout: FileListLayout): void {
  const sorted = sortChanges(changes);
  const laidOut = layout === 'tree' ? layoutPathTree({ sorted, keyOf: changeKey, folderScope: groupKey }) : layoutPathList(sorted, changeKey);
  // One at a time: spreading 100,000 rows into `push` passes more arguments than a call takes.
  for (const row of laidOut) rows.push(row);
}

function groupByChangelist(changes: PendingChange[], changelists: Changelist[]): Group[] {
  const defaultGroup: Group = {
    key: 'changelist:',
    label: DEFAULT_CHANGELIST_LABEL,
    changes: changes.filter((change) => !change.changelist),
  };
  const userGroups = changelists.map((changelist) => ({
    key: `changelist:${changelist.name}`,
    label: changelist.name,
    changelist,
    changes: changes.filter((change) => change.changelist === changelist.name),
  }));
  // Empty user changelists stay visible so they can be used as drop targets for "Move to changelist".
  return [defaultGroup, ...userGroups].filter((group) => group.changes.length > 0 || group.changelist);
}
