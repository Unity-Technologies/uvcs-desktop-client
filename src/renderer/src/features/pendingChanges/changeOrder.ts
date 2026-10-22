import type { PendingChange } from '@shared/domain/pendingChanges';
import { comparePaths, sortByPath } from '@shared/pathOrder';

/**
 * The order the rows show changes in, flat or a tree: by path, as every list of files (`comparePaths`), sorted folder
 * by folder (`sortByPath`), as `cm status` prints them in no order. Sorted once (`useSortedChanges`): filtering keeps
 * the order, and `layoutChangeRows` lays changes out as they come.
 */
export function sortChanges(changes: PendingChange[]): PendingChange[] {
  return sortByPath(changes, (change) => change.path);
}

/**
 * `changes` in `sortChanges` order, from the order a read before had (`previous`, sorted): the changes also in it (the
 * very objects: `sharePendingChanges` keeps those found as they were) stay in that order, and only the others are
 * sorted, then merged in, one comparison each. A refresh that changed a few of a million changes goes over them about
 * once, where sorting again took a second. A read that kept fewer than half is sorted afresh.
 */
export function sortedFromPrevious(changes: PendingChange[], previous: PendingChange[]): PendingChange[] {
  const current = new Set(changes);
  const kept = previous.filter((change) => current.has(change));
  if (kept.length === changes.length) return kept;
  if (kept.length < changes.length / 2) return sortChanges(changes);
  const keptSet = new Set(kept);
  return mergedByPath(kept, sortChanges(changes.filter((change) => !keptSet.has(change))));
}

/** Two lists sorted by path as one. */
function mergedByPath(a: PendingChange[], b: PendingChange[]): PendingChange[] {
  const merged: PendingChange[] = [];
  let [i, j] = [0, 0];
  while (i < a.length && j < b.length) merged.push(comparePaths(a[i]!.path, b[j]!.path) <= 0 ? a[i++]! : b[j++]!);
  while (i < a.length) merged.push(a[i++]!);
  while (j < b.length) merged.push(b[j++]!);
  return merged;
}
