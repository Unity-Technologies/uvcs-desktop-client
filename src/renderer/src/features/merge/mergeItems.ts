import type { DirectoryConflict, DirectoryConflictResolution, MergeChange, MergePlan } from '@shared/domain/merge';
import type { FileConflictState } from './resolve/useFileConflicts';

/** Something in the merge the user can look at: a conflict to decide or a change that applies cleanly. */
export type MergeItem =
  | { kind: 'directoryConflict'; key: string; index: number; conflict: DirectoryConflict; resolution: DirectoryConflictResolution | undefined }
  | { kind: 'fileConflict'; key: string; state: FileConflictState }
  | { kind: 'change'; key: string; change: MergeChange };

export type MergeListRow =
  | { type: 'section'; key: string; label: string; count: number; explanation: string }
  | { type: 'item'; key: string; item: MergeItem };

/** Conflicts first (directory ones, then files), then everything that merges cleanly. */
export function buildMergeItems(
  plan: MergePlan,
  fileStates: FileConflictState[],
  directoryResolutions: readonly (DirectoryConflictResolution | undefined)[],
): MergeItem[] {
  return [
    ...plan.directoryConflicts.map(
      (conflict, index): MergeItem => ({ kind: 'directoryConflict', key: `directory:${index}`, index, conflict, resolution: directoryResolutions[index] }),
    ),
    ...fileStates.map((state): MergeItem => ({ kind: 'fileConflict', key: `file:${state.file.key}`, state })),
    ...plan.changes.map((change, index): MergeItem => ({ kind: 'change', key: `change:${index}`, change })),
  ];
}

export function isConflict(item: MergeItem): boolean {
  return item.kind !== 'change';
}

export function needsDecision(item: MergeItem): boolean {
  if (item.kind === 'directoryConflict') return !item.resolution;
  if (item.kind === 'fileConflict') return !item.state.resolution;
  return false;
}

export function toListRows(items: MergeItem[]): MergeListRow[] {
  const conflicts = items.filter(isConflict);
  const changes = items.filter((item) => !isConflict(item));
  return [
    ...section('conflicts', 'Conflicts', 'Changed on both sides', conflicts),
    ...section('changes', 'Changes to apply', 'Changed on one side only', changes),
  ];
}

function section(key: string, label: string, explanation: string, items: MergeItem[]): MergeListRow[] {
  if (items.length === 0) return [];
  return [
    { type: 'section', key: `section:${key}`, label, count: items.length, explanation },
    ...items.map((item): MergeListRow => ({ type: 'item', key: item.key, item })),
  ];
}
