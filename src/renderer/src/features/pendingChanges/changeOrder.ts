import type { PendingChange } from '@shared/domain/pendingChanges';
import { comparePaths } from '@shared/pathOrder';

/**
 * The order the rows show changes in, flat or a tree: by path, as every list of files (`comparePaths`). Sorted once
 * (`useSortedChanges`): filtering keeps the order, and `layoutChangeRows` lays changes out as they come.
 */
export function sortChanges(changes: PendingChange[]): PendingChange[] {
  return [...changes].sort((a, b) => comparePaths(a.path, b.path));
}

/**
 * `changes` with those also in `previous` (the very objects: a read keeps the changes it found as they were) in the
 * order `previous` had them, then the others. A read that changed a few changes of a sorted list gives a list nearly
 * in order, which sorting goes through in about one comparison a change.
 */
export function inPreviousOrder(changes: PendingChange[], previous: PendingChange[]): PendingChange[] {
  const current = new Set(changes);
  const kept = previous.filter((change) => current.has(change));
  if (kept.length === changes.length) return kept;
  const keptSet = new Set(kept);
  return [...kept, ...changes.filter((change) => !keptSet.has(change))];
}
