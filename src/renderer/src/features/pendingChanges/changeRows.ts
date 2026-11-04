import type { Changelist, PendingChange } from '@shared/domain/pendingChanges';
import type { FileListLayout } from '../../components/fileListViewStore';
import type { StatusTone } from '../../components/StatusBadge';
import { statusGroupsOf } from '../../components/statusGroups';
import { collapseGroupedTreeRows, layoutGroupedTree, type GroupedTreeRow, type TreeGroup } from '../../lib/groupedPathTree';
import { itemsIn } from '../../lib/itemRange';
import { layoutPathItems, type ItemOrder } from '../../lib/pathTree';
import { changeTone } from './changeTone';

/**
 * What a header of the Changes list is: a changelist (`changelist` undefined for the default one), or the changes of
 * one status, inside their changelist when the list is grouped by both.
 */
export type ChangeGroup = { kind: 'changelist'; changelist: Changelist | undefined } | { kind: 'status'; tone: StatusTone };

/** A changelist, a status group, a folder of changes or a change, as every grouped list of files has them (`groupedPathTree`). */
export type ChangeRow = GroupedTreeRow<PendingChange, ChangeGroup>;

export type ChangesGrouping = 'none' | 'changelist';

export const DEFAULT_CHANGELIST_LABEL = 'Default changelist';

interface LayoutInput {
  /** The changes, in `sortChanges` order: filtering a sorted list keeps it in order, so it isn't sorted again here. */
  sorted: PendingChange[];
  changelists: Changelist[];
  layout: FileListLayout;
  grouping: ChangesGrouping;
  /** The changes of each status in a group of their own, inside their changelist when grouped by changelist too. */
  groupByStatus?: boolean;
  /** The order of the changes when not by path (`fileListOrder`). */
  order?: ItemOrder<PendingChange>;
}

interface Group {
  key: string;
  label: string;
  changelist?: Changelist;
  changes: PendingChange[];
}

/**
 * Flattens pending changes into the rows of the list: changelist and status headers, optional folders and changes.
 * Every row, as if nothing was collapsed: opening or closing a folder only leaves rows out (`collapseRows`). What is
 * checked is left to `checkStateOver`: checking files doesn't lay tens of thousands of rows out again either.
 */
export function layoutChangeRows({ sorted, changelists, layout, grouping, groupByStatus = false, order }: LayoutInput): ChangeRow[] {
  const tree = layout === 'tree';
  if (grouping === 'none' && !groupByStatus) return layoutPathItems(sorted, changeKey, { tree, folderScope: 'all', order });
  return layoutGroupedTree(changeGroupsOf(sorted, changelists, grouping, groupByStatus), changeKey, tree, order);
}

/** The groups of the list: its changelists, each with its status groups when asked for; or the status groups alone. */
function changeGroupsOf(sorted: PendingChange[], changelists: Changelist[], grouping: ChangesGrouping, groupByStatus: boolean): TreeGroup<PendingChange, ChangeGroup>[] {
  const byStatus = (changes: PendingChange[], scope: string) => statusGroupsOf<PendingChange, ChangeGroup>({ sorted: changes, toneOf: changeTone, scope, groupOf: (tone) => ({ kind: 'status', tone }) });
  if (grouping === 'none') return byStatus(sorted, 'all');
  return groupByChangelist(sorted, changelists).map(({ key, label, changelist, changes }) => ({
    key,
    label,
    group: { kind: 'changelist', changelist },
    sorted: changes,
    subgroups: groupByStatus ? byStatus(changes, key) : undefined,
  }));
}

/** The rows laid out by `layoutChangeRows` but for what collapsed changelists and folders hold. */
export function collapseRows(rows: ChangeRow[], collapsed: ReadonlySet<string>): ChangeRow[] {
  return collapseGroupedTreeRows(rows, collapsed);
}

/** The row of the change to an item, by its path: what selects it from elsewhere (`selectInView`, a link). */
export function changeRowKey(path: string): string {
  return `change:${path}`;
}

/** Kept per change: lists of tens of thousands of rows look keys up in maps and sets, which hash each new string again. */
const changeKeys = new WeakMap<PendingChange, string>();

export function changeKey(change: PendingChange): string {
  let key = changeKeys.get(change);
  if (key === undefined) {
    key = changeRowKey(change.path);
    changeKeys.set(change, key);
  }
  return key;
}

/** The changes a row stands for: all changes in a group or folder, or the change itself. */
export function changesUnderRow(row: ChangeRow): PendingChange[] {
  return row.type === 'file' ? [row.item] : itemsIn(row.held);
}

/**
 * What the menu of a right-clicked row is for: a user changelist, the changes in a folder, a status group or the
 * default changelist, or the selected files (null).
 */
export function menuTargetOf(row: ChangeRow | null): Changelist | PendingChange[] | null {
  if (!row || row.type === 'file') return null;
  return row.type === 'group' && row.group.kind === 'changelist' && row.group.changelist ? row.group.changelist : itemsIn(row.held);
}

/** The user changelist a header is, or undefined: the default changelist, a status group. */
export function changelistOfGroup(group: ChangeGroup): Changelist | undefined {
  return group.kind === 'changelist' ? group.changelist : undefined;
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
