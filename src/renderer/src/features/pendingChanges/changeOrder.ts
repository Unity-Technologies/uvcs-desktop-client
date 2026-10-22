import type { PendingChange } from '@shared/domain/pendingChanges';
import { sortByPath } from '@shared/pathOrder';

/**
 * The order the rows show changes in, flat or a tree: by path, as every list of files (`comparePaths`), sorted folder
 * by folder (`sortByPath`), as `cm status` prints them in no order. Sorted once (`useSortedChanges`): filtering keeps
 * the order, and `layoutChangeRows` lays changes out as they come.
 */
export function sortChanges(changes: PendingChange[]): PendingChange[] {
  return sortByPath(changes, (change) => change.path);
}
