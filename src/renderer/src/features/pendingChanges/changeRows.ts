import type { Changelist, PendingChange } from '@shared/domain/pendingChanges';
import { compareTones } from '../../components/changeFilter';
import type { CheckState } from '../../ui/Checkbox';
import { changeTone } from './changeTone';

/** A changelist header. */
interface GroupRow {
  type: 'group';
  key: string;
  label: string;
  /** Set when the group is a user changelist. */
  changelist?: Changelist;
  changes: PendingChange[];
  checkState: CheckState;
  collapsed: boolean;
}

interface DirectoryRow {
  type: 'directory';
  key: string;
  path: string;
  name: string;
  depth: number;
  /** The folder's own change, when it is one (a new private folder, an added or a deleted one). */
  change?: PendingChange;
  /** Every change in the folder, its own included. */
  changes: PendingChange[];
  checkState: CheckState;
  collapsed: boolean;
}

interface ChangeItemRow {
  type: 'change';
  key: string;
  change: PendingChange;
  depth: number;
  checked: boolean;
}

export type ChangeRow = GroupRow | DirectoryRow | ChangeItemRow;

export type ChangesLayout = 'list' | 'tree';
export type ChangesGrouping = 'none' | 'changelist';

export const DEFAULT_CHANGELIST_LABEL = 'Default changelist';

interface BuildRowsInput {
  changes: PendingChange[];
  changelists: Changelist[];
  layout: ChangesLayout;
  grouping: ChangesGrouping;
  isChecked: (change: PendingChange) => boolean;
  /** Keys of collapsed groups and directories. */
  collapsed: ReadonlySet<string>;
}

interface Group {
  key: string;
  label: string;
  changelist?: Changelist;
  changes: PendingChange[];
}

/** Flattens pending changes into the rows of the list: changelist headers, optional folders and changes. */
export function buildChangeRows({ changes, changelists, layout, grouping, isChecked, collapsed }: BuildRowsInput): ChangeRow[] {
  const rows: ChangeRow[] = [];
  if (grouping === 'none') {
    appendChangeRows(rows, changes, 'all', layout, isChecked, collapsed);
    return rows;
  }

  for (const group of groupByChangelist(changes, changelists)) {
    const sorted = sortByPath(group.changes);
    rows.push({
      type: 'group',
      key: group.key,
      label: group.label,
      changelist: group.changelist,
      changes: sorted,
      checkState: combinedCheckState(sorted, isChecked),
      collapsed: collapsed.has(group.key),
    });
    if (!collapsed.has(group.key)) appendChangeRows(rows, sorted, group.key, layout, isChecked, collapsed);
  }
  return rows;
}

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

/** Changelist headers lead the rows: the top-level checkboxes are theirs, after their chevrons. */
export function topLevelCheckboxInset(rows: ChangeRow[]): number {
  return rows.some((row) => row.type === 'group') ? LEVEL_INDENT : 0;
}

export function changeKey(change: PendingChange): string {
  return `change:${change.path}`;
}

/** The changes a row stands for: all changes in a group or folder, or the change itself. */
export function changesUnderRow(row: ChangeRow): PendingChange[] {
  return row.type === 'change' ? [row.change] : row.changes;
}

/**
 * Folder by folder, so everything in a folder comes right after it: comparing whole paths puts "a-b.txt" between "a"
 * and "a/c.txt", and "src/b" between "Src/a" and "Src/c".
 */
export function comparePaths(a: string, b: string): number {
  const aParts = a.split('/');
  const bParts = b.split('/');
  for (let index = 0; index < Math.min(aParts.length, bParts.length); index++) {
    const order = aParts[index]!.localeCompare(bParts[index]!);
    if (order !== 0) return order;
  }
  return aParts.length - bParts.length;
}

/** What the menu of a right-clicked row is for: a changelist, the changes in a folder or the default changelist, or the selected files (null). */
export function menuTargetOf(row: ChangeRow | null): Changelist | PendingChange[] | null {
  if (!row || row.type === 'change') return null;
  return row.type === 'group' && row.changelist ? row.changelist : row.changes;
}

function sortByPath(changes: PendingChange[]): PendingChange[] {
  return [...changes].sort((a, b) => comparePaths(a.path, b.path));
}

/** A flat list reads by kind of change first, in the order of the filter chips; a tree has to follow the folders. */
export function sortByStatus(changes: PendingChange[]): PendingChange[] {
  return [...changes].sort((a, b) => compareTones(changeTone(a), changeTone(b)) || a.path.localeCompare(b.path));
}

function appendChangeRows(
  rows: ChangeRow[],
  changes: PendingChange[],
  groupKey: string,
  layout: ChangesLayout,
  isChecked: (change: PendingChange) => boolean,
  collapsed: ReadonlySet<string>,
): void {
  if (layout === 'tree') {
    appendTreeRows(rows, sortByPath(changes), groupKey, isChecked, collapsed);
    return;
  }
  sortByStatus(changes).forEach((change) => rows.push({ type: 'change', key: changeKey(change), change, depth: 0, checked: isChecked(change) }));
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

function appendTreeRows(
  rows: ChangeRow[],
  changes: PendingChange[],
  groupKey: string,
  isChecked: (change: PendingChange) => boolean,
  collapsed: ReadonlySet<string>,
): void {
  const byPath = new Map(changes.map((change) => [change.path, change]));
  const folders = new Set(changes.flatMap((change) => foldersAbove(change.path)));
  const emittedDirectories = new Set<string>();
  let hiddenBelow: string | null = null;

  for (const change of changes) {
    if (hiddenBelow && change.path.startsWith(`${hiddenBelow}/`)) continue;
    hiddenBelow = null;

    // A folder that is a change itself and holds others is their folder's row, not one more row next to it.
    const isFolder = folders.has(change.path);
    const directories = change.path.split('/').slice(0, isFolder ? undefined : -1);
    let collapsedHere = false;
    directories.forEach((name, depth) => {
      if (collapsedHere) return;
      const path = directories.slice(0, depth + 1).join('/');
      const key = `directory:${groupKey}:${path}`;
      if (!emittedDirectories.has(path)) {
        emittedDirectories.add(path);
        const inside = changes.filter((candidate) => candidate.path === path || candidate.path.startsWith(`${path}/`));
        rows.push({
          type: 'directory',
          key,
          path,
          name,
          depth,
          change: byPath.get(path),
          changes: inside,
          checkState: combinedCheckState(inside, isChecked),
          collapsed: collapsed.has(key),
        });
      }
      if (collapsed.has(key)) {
        collapsedHere = true;
        hiddenBelow = path;
      }
    });

    if (!collapsedHere && !isFolder) rows.push({ type: 'change', key: changeKey(change), change, depth: directories.length, checked: isChecked(change) });
  }
}

/** "a/b/c.txt" is in "a" and "a/b". */
function foldersAbove(path: string): string[] {
  const parts = path.split('/');
  return parts.slice(1).map((_, index) => parts.slice(0, index + 1).join('/'));
}

function combinedCheckState(changes: PendingChange[], isChecked: (change: PendingChange) => boolean): CheckState {
  const checkedCount = changes.filter(isChecked).length;
  if (checkedCount === 0) return false;
  return checkedCount === changes.length ? true : 'mixed';
}
