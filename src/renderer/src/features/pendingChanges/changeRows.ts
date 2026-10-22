import type { Changelist, PendingChange } from '@shared/domain/pendingChanges';
import type { FileListLayout } from '../../components/fileListLayoutStore';
import { collapseGroupedTreeRows, layoutGroupedTree, type GroupedTreeRow } from '../../lib/groupedPathTree';
import { layoutPathList, layoutPathTree } from '../../lib/pathTree';

/**
 * A changelist, a folder of changes or a change, as every grouped list of files has them (`groupedPathTree`). A
 * changelist's `group` is the user changelist it is, undefined for the default one.
 */
export type ChangeRow = GroupedTreeRow<PendingChange, Changelist | undefined>;

export type ChangesGrouping = 'none' | 'changelist';

export const DEFAULT_CHANGELIST_LABEL = 'Default changelist';

interface LayoutInput {
  /** The changes, in `sortChanges` order: filtering a sorted list keeps it in order, so it isn't sorted again here. */
  sorted: PendingChange[];
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
export function layoutChangeRows({ sorted, changelists, layout, grouping }: LayoutInput): ChangeRow[] {
  if (grouping === 'none') {
    return layout === 'tree' ? layoutPathTree({ sorted, keyOf: changeKey, folderScope: 'all' }) : layoutPathList(sorted, changeKey);
  }
  const groups = groupByChangelist(sorted, changelists).map(({ key, label, changelist, changes: inGroup }) => ({ key, label, group: changelist, sorted: inGroup }));
  return layoutGroupedTree(groups, changeKey, layout === 'tree');
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
  return row.type === 'file' ? [row.item] : row.items;
}

/** What the menu of a right-clicked row is for: a changelist, the changes in a folder or the default changelist, or the selected files (null). */
export function menuTargetOf(row: ChangeRow | null): Changelist | PendingChange[] | null {
  if (!row || row.type === 'file') return null;
  return row.type === 'group' && row.group ? row.group : row.items;
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
