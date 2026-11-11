import type { PartialIncomingItem } from '@shared/domain/incoming';
import type { DiffEntry, DiffStatus } from '@shared/domain/diff';
import { comparePaths } from '@shared/pathOrder';
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

/**
 * Names one item in the list. A path alone isn't enough: the branch can remove an item and add another at its path,
 * and both are listed.
 */
export function partialItemKey(item: PartialIncomingItem): string {
  return `${item.kind}:${item.path}`;
}

/** The item selected when Incoming opens: the first listed. */
export function firstPartialItemKey(groups: readonly PartialItemGroup[]): string | null {
  const first = groups[0]?.items[0];
  return first ? partialItemKey(first) : null;
}

/** What the detail pane shows for the selected item: its diff, or why there is none. */
export type PartialSelectionDetail = { kind: 'diff'; entry: DiffEntry } | { kind: 'empty'; title: string };

export function partialSelectionDetail(items: readonly PartialIncomingItem[], selectedKey: string | null, repository: string | undefined): PartialSelectionDetail {
  const selected = items.find((item) => partialItemKey(item) === selectedKey);
  const entry = selected ? partialItemDiffEntry(selected, repository) : null;
  if (entry) return { kind: 'diff', entry };
  return { kind: 'empty', title: selected?.isDirectory ? 'A folder has no diff' : 'Select an item' };
}

/**
 * Whether updating brings anything: an item changed here and on the branch keeps its local version, so when every
 * item is one of those, Update has nothing to do and isn't offered. Incoming and the incoming card both ask this.
 */
export function canUpdatePartial(itemCount: number, conflictCount: number): boolean {
  return itemCount > conflictCount;
}

/** How many items the incoming card leaves out ("and N more"): none while its items load. */
export function morePartialItems(count: number, listed: readonly PartialIncomingItem[] | undefined): number {
  return listed && listed.length > 0 ? Math.max(0, count - listed.length) : 0;
}
