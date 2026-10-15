import type { DirectoryConflict, DirectoryConflictResolution, MergeChange, MergePlan } from '@shared/domain/merge';
import { comparePaths } from '@shared/pathOrder';
import { statusTones } from '../../components/changeFilter';
import type { StatusTone } from '../../components/StatusBadge';
import { withoutRepeatedFolders } from '../../lib/enclosingFolders';
import type { GroupedTreeRow, TreeGroup } from '../../lib/groupedPathTree';
import type { ConflictedFile, FileConflictState } from './resolve/useFileConflicts';

/**
 * Something in the merge the user can look at: a conflict to decide or a change that applies cleanly. `path` is
 * where it is, without the root ("src/app.ts"), as the list shows it. Items come from the plan alone and never change
 * with it: where a conflict stands is the `MergeProgress`.
 */
export type MergeItem = { key: string; path: string } & (
  | { kind: 'directoryConflict'; index: number; conflict: DirectoryConflict }
  | { kind: 'fileConflict'; file: ConflictedFile }
  | { kind: 'change'; change: MergeChange }
);

/**
 * Where the conflicts stand: each file's state, by its key, as its versions load and the user decides, and each
 * directory conflict's resolution, by its index. Kept apart from the items: thousands of them are sorted and laid out
 * once, and a status changing (thousands do while the versions load) only draws again the rows that show it.
 */
export interface MergeProgress {
  fileStates: ReadonlyMap<string, FileConflictState>;
  directoryResolutions: readonly (DirectoryConflictResolution | undefined)[];
}

export function mergeProgress(fileStates: readonly FileConflictState[], directoryResolutions: readonly (DirectoryConflictResolution | undefined)[]): MergeProgress {
  return { fileStates: new Map(fileStates.map((state) => [state.file.key, state])), directoryResolutions };
}

/** A conflicting file's state: every file of the plan has one, from the first render (`useFileConflicts`). */
export function fileStateOf(item: Extract<MergeItem, { kind: 'fileConflict' }>, progress: MergeProgress): FileConflictState {
  const state = progress.fileStates.get(item.file.key);
  if (!state) throw new Error(`No state for the conflicting file ${item.file.key}`);
  return state;
}

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
export function buildMergeItems(plan: MergePlan, conflictedFiles: readonly ConflictedFile[]): MergeItem[] {
  return [
    ...plan.directoryConflicts.map(
      (conflict, index): MergeItem => ({
        kind: 'directoryConflict',
        key: `directory:${index}`,
        path: withoutRoot(conflict.destination.path),
        index,
        conflict,
      }),
    ),
    ...conflictedFiles.map((file): MergeItem => ({ kind: 'fileConflict', key: `file:${file.key}`, path: withoutRoot(file.path), file })),
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

export function needsDecision(item: MergeItem, progress: MergeProgress): boolean {
  if (item.kind === 'directoryConflict') return !progress.directoryResolutions[item.index];
  if (item.kind === 'fileConflict') return !fileStateOf(item, progress).resolution;
  return false;
}

/** The items in the order the list shows them: by group, then by path (as a list, and as a tree, folder by folder). */
export function inListOrder(items: MergeItem[]): MergeItem[] {
  return mergeItemGroups(items).flatMap((group) => group.sorted);
}

/** The first item still waiting for the user, as the list shows them: where the page starts, and goes after a run. */
export function firstWaiting(items: MergeItem[], progress: MergeProgress): MergeItem | undefined {
  return inListOrder(items).find((item) => needsDecision(item, progress));
}

/**
 * The item shown by the row keyed `key`: its own row, or a folder's row when the item is that folder. A folder
 * conflict holding another conflict (a folder added on both sides, a file in it changed on both) is its folder's row
 * in a tree (`layoutPathTree`), with no row of its own: selecting that row is selecting the conflict.
 */
export function mergeItemAt(items: MergeItem[], rows: readonly GroupedTreeRow<MergeItem, MergeGroup>[], key: string | null): MergeItem | undefined {
  if (key === null) return undefined;
  const item = items.find((candidate) => candidate.key === key);
  if (item) return item;
  const row = rows.find((candidate) => candidate.key === key);
  return row?.type === 'folder' ? row.item : undefined;
}

/**
 * What a menu over the rows `selected` acts on: what they hold (`underRows`), but a folder conflict's row alone acts on
 * that conflict, so its menu offers its choices (`mergeItemAt`).
 */
export function mergeItemsActedOn(rows: readonly GroupedTreeRow<MergeItem, MergeGroup>[], selected: ReadonlySet<string>, underRows: MergeItem[]): MergeItem[] {
  if (selected.size !== 1) return underRows;
  const row = rows.find((candidate) => selected.has(candidate.key));
  return row?.type === 'folder' && row.item && row.item.kind !== 'change' ? [row.item] : underRows;
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
