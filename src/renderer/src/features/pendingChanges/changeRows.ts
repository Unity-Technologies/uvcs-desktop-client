import type { Changelist, PendingChange } from '@shared/domain/pendingChanges';
import { sortForLayout } from './changeOrder';
import { treeLevel } from './changeRowLevels';

/** A changelist header. */
interface GroupRow {
  type: 'group';
  key: string;
  label: string;
  /** Set when the group is a user changelist. */
  changelist?: Changelist;
  changes: PendingChange[];
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
  collapsed: boolean;
}

interface ChangeItemRow {
  type: 'change';
  key: string;
  change: PendingChange;
  depth: number;
}

export type ChangeRow = GroupRow | DirectoryRow | ChangeItemRow;

export type ChangesLayout = 'list' | 'tree';
export type ChangesGrouping = 'none' | 'changelist';

export const DEFAULT_CHANGELIST_LABEL = 'Default changelist';

interface LayoutInput {
  changes: PendingChange[];
  changelists: Changelist[];
  layout: ChangesLayout;
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
    const sorted = sortForLayout(group.changes, layout);
    rows.push({
      type: 'group',
      key: group.key,
      label: group.label,
      changelist: group.changelist,
      changes: sorted,
      collapsed: false,
    });
    appendChangeRows(rows, sorted, group.key, layout);
  }
  return rows;
}

/** The rows laid out by `layoutChangeRows` but for what collapsed changelists and folders hold. */
export function collapseRows(rows: ChangeRow[], collapsed: ReadonlySet<string>): ChangeRow[] {
  if (collapsed.size === 0) return rows;
  // Changelists, when there are any, lead the rows.
  const grouped = rows[0]?.type === 'group';
  const shown: ChangeRow[] = [];
  // The level of the collapsed row whose contents are being left out.
  let hiddenBelow = Infinity;
  for (const row of rows) {
    const level = treeLevel(row, grouped);
    if (level > hiddenBelow) continue;
    hiddenBelow = Infinity;
    if (row.type !== 'change' && collapsed.has(row.key)) {
      shown.push({ ...row, collapsed: true });
      hiddenBelow = level;
    } else {
      shown.push(row);
    }
  }
  return shown;
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
  return row.type === 'change' ? [row.change] : row.changes;
}

/** What the menu of a right-clicked row is for: a changelist, the changes in a folder or the default changelist, or the selected files (null). */
export function menuTargetOf(row: ChangeRow | null): Changelist | PendingChange[] | null {
  if (!row || row.type === 'change') return null;
  return row.type === 'group' && row.changelist ? row.changelist : row.changes;
}

function appendChangeRows(rows: ChangeRow[], changes: PendingChange[], groupKey: string, layout: ChangesLayout): void {
  const sorted = sortForLayout(changes, layout);
  if (layout === 'tree') {
    appendTreeRows(rows, sorted, groupKey);
    return;
  }
  sorted.forEach((change) => rows.push({ type: 'change', key: changeKey(change), change, depth: 0 }));
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

function appendTreeRows(rows: ChangeRow[], changes: PendingChange[], groupKey: string): void {
  const byPath = new Map(changes.map((change) => [change.path, change]));
  // Each change's path and the folders above it ("a", "a/b", "a/b/c.txt"), built once: every level is looked up by them.
  const prefixes = changes.map((change) => pathPrefixes(change.path));
  const folders = new Set<string>();
  for (const paths of prefixes) for (let level = 0; level < paths.length - 1; level++) folders.add(paths[level]!);
  // The row showing each folder: folders that only hold the next one share its row ("deep/very/long").
  const folderRows = new Map<string, DirectoryRow>();
  // The level of the innermost folder each row shows.
  const lastLevels = new Map<DirectoryRow, number>();

  changes.forEach((change, index) => {
    const paths = prefixes[index]!;
    const pathAt = (level: number): string => paths[level]!;
    // A folder that is a change itself and holds others is their folder's row, not one more row next to it.
    const isFolder = folders.has(change.path);
    const folderCount = isFolder ? paths.length : paths.length - 1;
    let depth = 0;
    for (let level = 0; level < folderCount; level++) {
      let row = folderRows.get(pathAt(level));
      if (!row) {
        const inside = changesInFolder(changes, index, pathAt(level));
        let last = level;
        while (last + 1 < folderCount && !byPath.has(pathAt(last)) && holdsOnly(inside, pathAt(last + 1))) last++;
        const path = pathAt(last);
        const key = `directory:${groupKey}:${path}`;
        row = {
          type: 'directory',
          key,
          path,
          name: level === 0 ? path : path.slice(pathAt(level - 1).length + 1),
          depth,
          change: byPath.get(path),
          changes: inside,
          collapsed: false,
        };
        rows.push(row);
        lastLevels.set(row, last);
        for (let chained = level; chained <= last; chained++) folderRows.set(pathAt(chained), row);
      }
      level = lastLevels.get(row)!;
      depth = row.depth + 1;
    }

    if (!isFolder) rows.push({ type: 'change', key: changeKey(change), change, depth });
  });
}

/** Whether all a folder holds is `child`, one of its folders, or in it. */
function holdsOnly(inside: PendingChange[], child: string): boolean {
  // Sorted by `comparePaths`, the first and the last change tell for all of them.
  return [inside[0]!, inside.at(-1)!].every((change) => change.path === child || change.path.startsWith(`${child}/`));
}

/** The changes in a folder, first met at `first`: sorted by `comparePaths`, they are the ones right after it. */
function changesInFolder(sorted: PendingChange[], first: number, folder: string): PendingChange[] {
  const inside = `${folder}/`;
  let end = first;
  while (end < sorted.length && (sorted[end]!.path === folder || sorted[end]!.path.startsWith(inside))) end++;
  return sorted.slice(first, end);
}

/** "a/b/c.txt" is in "a" and "a/b": ["a", "a/b", "a/b/c.txt"]. */
function pathPrefixes(path: string): string[] {
  const prefixes: string[] = [];
  for (let end = path.indexOf('/'); end !== -1; end = path.indexOf('/', end + 1)) prefixes.push(path.slice(0, end));
  prefixes.push(path);
  return prefixes;
}
