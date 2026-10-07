import type { DirectoryConflict, DirectoryConflictResolution, MergeChange, MergePlan } from '@shared/domain/merge';
import { comparePaths } from '@shared/pathOrder';
import { statusTones } from '../../components/changeFilter';
import type { StatusTone } from '../../components/StatusBadge';
import { withoutRepeatedFolders } from '../../lib/enclosingFolders';
import type { GroupedTreeRow, TreeGroup } from '../../lib/groupedPathTree';
import type { FileConflictState } from './resolve/useFileConflicts';

/**
 * Something in the merge the user can look at: a conflict to decide or a change that applies cleanly. `path` is
 * where it is, without the root ("src/app.ts"), as the list shows it.
 */
export type MergeItem = { key: string; path: string } & (
  | { kind: 'directoryConflict'; index: number; conflict: DirectoryConflict; resolution: DirectoryConflictResolution | undefined }
  | { kind: 'fileConflict'; state: FileConflictState }
  | { kind: 'change'; change: MergeChange }
);

/** The merge page's groups: what both sides changed, and what applies cleanly. */
export type MergeGroup = 'conflicts' | 'changes';

export const MERGE_GROUP_TIPS: Record<MergeGroup, string> = {
  conflicts: 'Changed on both sides',
  changes: 'Changed on one side only',
};

/**
 * Conflicts first (directory ones, then files), then everything that merges cleanly, but a folder added or deleted
 * with what it holds: its items say it already, as in a diff (`withoutRepeatedFolders`); a moved one stays.
 */
export function buildMergeItems(
  plan: MergePlan,
  fileStates: FileConflictState[],
  directoryResolutions: readonly (DirectoryConflictResolution | undefined)[],
): MergeItem[] {
  return [
    ...plan.directoryConflicts.map(
      (conflict, index): MergeItem => ({
        kind: 'directoryConflict',
        key: `directory:${index}`,
        path: withoutRoot(conflict.destination.path),
        index,
        conflict,
        resolution: directoryResolutions[index],
      }),
    ),
    ...fileStates.map((state): MergeItem => ({ kind: 'fileConflict', key: `file:${state.file.key}`, path: withoutRoot(state.file.path), state })),
    ...withoutRepeatedFolders(
      plan.changes.map((change, index): MergeItem & { kind: 'change' } => ({ kind: 'change', key: `change:${index}`, path: withoutRoot(change.path), change })),
      (item) => item.change.path,
      (item) => item.change.kind === 'moved',
    ),
  ];
}

function isConflict(item: MergeItem): boolean {
  return item.kind !== 'change';
}

export function needsDecision(item: MergeItem): boolean {
  if (item.kind === 'directoryConflict') return !item.resolution;
  if (item.kind === 'fileConflict') return !item.state.resolution;
  return false;
}

/** The items in the order the list shows them: by group, then by path (as a list, and as a tree, folder by folder). */
export function inListOrder(items: MergeItem[]): MergeItem[] {
  return mergeItemGroups(items).flatMap((group) => group.sorted);
}

/** The first item still waiting for the user, as the list shows them: where the page starts, and goes after a run. */
export function firstWaiting(items: MergeItem[]): MergeItem | undefined {
  return inListOrder(items).find(needsDecision);
}

/** The item shown by the row keyed `key`: its own row, or a folder's row when the item is that folder (`mergeItemAt`). */
export function mergeItemAt(items: MergeItem[], rows: readonly GroupedTreeRow<MergeItem, MergeGroup>[], key: string | null): MergeItem | undefined {
  return undefined;
}

/** What a menu over the rows `selected` acts on (`mergeItemsActedOn`). */
export function mergeItemsActedOn(rows: readonly GroupedTreeRow<MergeItem, MergeGroup>[], selected: ReadonlySet<string>, underRows: MergeItem[]): MergeItem[] {
  return underRows;
}

/** The conflicts, then the changes that apply cleanly, each in path order as every list of changed files; empty ones left out. */
export function mergeItemGroups(items: MergeItem[]): TreeGroup<MergeItem, MergeGroup>[] {
  const byPath = (a: MergeItem, b: MergeItem): number => comparePaths(a.path, b.path);
  const groups: TreeGroup<MergeItem, MergeGroup>[] = [
    { key: 'group:conflicts', label: 'Conflicts', group: 'conflicts', sorted: items.filter(isConflict).sort(byPath) },
    { key: 'group:changes', label: 'Changes to apply', group: 'changes', sorted: items.filter((item) => !isConflict(item)).sort(byPath) },
  ];
  return groups.filter((group) => group.sorted.length > 0);
}

/** An item's statuses for the filter's chips: what the merge does to it, and "Conflicts" for a conflict. */
export function mergeItemTones(item: MergeItem): readonly StatusTone[] {
  switch (item.kind) {
    case 'directoryConflict':
      return [item.conflict.source.operation, 'conflict'];
    case 'fileConflict':
      return ['changed', 'conflict'];
    case 'change':
      return statusTones(item.change.kind, false);
  }
}

function withoutRoot(path: string): string {
  return path.replace(/^\//, '');
}
