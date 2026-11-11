import type { PartialIncomingChanges, PartialIncomingItem } from '@shared/domain/incoming';
import type { DiffEntry, DiffStatus } from '@shared/domain/diff';
import { comparePaths } from '@shared/pathOrder';
import { branchLabel } from '../../lib/branchLabels';
import { pluralize } from '../../lib/text';

/** Items a partial workspace's Incoming lists under one title. */
export interface PartialItemGroup {
  title: string;
  items: PartialIncomingItem[];
}

const TITLES: Record<PartialIncomingItem['kind'], string> = { changed: 'Changed', moved: 'Moved', removed: 'Removed', added: 'Added' };

/**
 * What Incoming lists in a partial workspace: the items changed here and on the branch first (updating keeps their
 * local version), then the rest by what the branch did to them, each group in the order of every file list
 * (`comparePaths`). Empty groups are left out.
 */
export function partialItemGroups(items: readonly PartialIncomingItem[]): PartialItemGroup[] {
  const conflicts = items.filter((item) => item.conflict);
  const rest = items.filter((item) => !item.conflict);
  const groups: PartialItemGroup[] = [
    { title: 'Conflicts', items: conflicts },
    ...(Object.keys(TITLES) as PartialIncomingItem['kind'][]).map((kind) => ({ title: TITLES[kind], items: rest.filter((item) => item.kind === kind) })),
  ];
  return groups.filter((group) => group.items.length > 0).map((group) => ({ ...group, items: [...group.items].sort((a, b) => comparePaths(a.path, b.path)) }));
}

/** The line under an item's path: what the branch did to it, where a moved one was, or that it collides. */
export function partialItemDetail(item: PartialIncomingItem): string {
  if (item.conflict) return 'Changed here and on the branch';
  if (item.kind === 'moved' && item.oldPath) return `Moved from ${item.oldPath}`;
  return TITLES[item.kind];
}

/**
 * What the update bar says: how many items updating brings from the branch, and how many it leaves alone because they
 * were changed locally too (`cm partial update` keeps the local version until the change is checked in, shelved or undone).
 */
export function partialUpdateMessage(incoming: PartialIncomingChanges): string {
  const conflictCount = incoming.items.filter((item) => item.conflict).length;
  const bringCount = incoming.items.length - conflictCount;
  const brings = bringCount > 0 ? `Updating brings ${pluralize(bringCount, 'item')} from ${branchLabel(incoming.branch)}.` : '';
  const them = conflictCount === 1 ? 'it' : 'them';
  const kept = conflictCount === 0 ? '' : `${partialConflictNote(conflictCount)} until you check ${them} in, shelve ${them} or undo ${them}.`;
  return [brings, kept].filter(Boolean).join(' ');
}

/** What the incoming card notes about the items changed both here and on the branch: updating leaves them alone. */
export function partialConflictNote(conflictCount: number): string {
  return conflictCount === 1 ? '1 item you changed keeps your version' : `${pluralize(conflictCount, 'item')} you changed keep your version`;
}

const DIFF_STATUS: Record<PartialIncomingItem['kind'], DiffStatus> = { changed: 'changed', moved: 'moved', removed: 'deleted', added: 'added' };

/**
 * What the diff pane compares for an item: the revision the workspace loaded against the branch head's (nothing on the
 * side where the item doesn't exist). None for a directory, or before the workspace's repository is known.
 */
export function partialItemDiffEntry(item: PartialIncomingItem, repository: string | undefined): DiffEntry | null {
  if (item.isDirectory || !repository) return null;
  return {
    status: DIFF_STATUS[item.kind],
    path: item.path,
    ...(item.oldPath ? { oldPath: item.oldPath } : {}),
    itemType: 'file',
    baseRevisionId: item.loadedRevisionId ?? -1,
    revisionId: item.headRevisionId ?? -1,
    repository,
  };
}
