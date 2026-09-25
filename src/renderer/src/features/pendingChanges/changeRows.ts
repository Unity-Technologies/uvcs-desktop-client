import type { Changelist, PendingChange } from '@shared/domain/pendingChanges';
import type { CheckState } from '../../ui/Checkbox';

/** A header grouping changes: all of them, or a changelist. */
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

/** Flattens pending changes into the rows of the list: group headers, optional folders and changes. */
export function buildChangeRows({ changes, changelists, layout, grouping, isChecked, collapsed }: BuildRowsInput): ChangeRow[] {
  const groups = grouping === 'none' ? [allChanges(changes)] : groupByChangelist(changes, changelists);
  const rows: ChangeRow[] = [];

  for (const group of groups) {
    const sorted = [...group.changes].sort((a, b) => a.path.localeCompare(b.path));
    rows.push({
      type: 'group',
      key: group.key,
      label: group.label,
      changelist: group.changelist,
      changes: sorted,
      checkState: combinedCheckState(sorted, isChecked),
      collapsed: collapsed.has(group.key),
    });
    if (collapsed.has(group.key)) continue;

    if (layout === 'list') {
      sorted.forEach((change) => rows.push({ type: 'change', key: changeKey(change), change, depth: 0, checked: isChecked(change) }));
    } else {
      appendTreeRows(rows, sorted, group.key, isChecked, collapsed);
    }
  }
  return rows;
}

export function changeKey(change: PendingChange): string {
  return `change:${change.path}`;
}

/** The changes a row stands for: all changes in a group or folder, or the change itself. */
export function changesUnderRow(row: ChangeRow): PendingChange[] {
  return row.type === 'change' ? [row.change] : row.changes;
}

function allChanges(changes: PendingChange[]): Group {
  return { key: 'all', label: 'All changes', changes };
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
  const emittedDirectories = new Set<string>();
  let hiddenBelow: string | null = null;

  for (const change of changes) {
    if (hiddenBelow && change.path.startsWith(`${hiddenBelow}/`)) continue;
    hiddenBelow = null;

    const directories = change.path.split('/').slice(0, -1);
    let collapsedHere = false;
    directories.forEach((name, depth) => {
      if (collapsedHere) return;
      const path = directories.slice(0, depth + 1).join('/');
      const key = `directory:${groupKey}:${path}`;
      if (!emittedDirectories.has(path)) {
        emittedDirectories.add(path);
        const inside = changes.filter((candidate) => candidate.path.startsWith(`${path}/`));
        rows.push({ type: 'directory', key, path, name, depth, changes: inside, checkState: combinedCheckState(inside, isChecked), collapsed: collapsed.has(key) });
      }
      if (collapsed.has(key)) {
        collapsedHere = true;
        hiddenBelow = path;
      }
    });

    if (!collapsedHere) rows.push({ type: 'change', key: changeKey(change), change, depth: directories.length, checked: isChecked(change) });
  }
}

function combinedCheckState(changes: PendingChange[], isChecked: (change: PendingChange) => boolean): CheckState {
  const checkedCount = changes.filter(isChecked).length;
  if (checkedCount === 0) return false;
  return checkedCount === changes.length ? true : 'mixed';
}
