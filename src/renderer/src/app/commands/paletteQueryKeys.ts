import type { QueryFilter } from '@shared/domain/query';
import { queryKeys } from '../../api/queryKeys';

/**
 * The palette reads the same lists as the views (`queryKeys.inWorkspace(path, area, filter)`), so a list either one
 * read answers the other, and an operation refreshing a view refreshes the palette's copy too.
 */
export function branchesKey(workspacePath: string, filter: QueryFilter) {
  return queryKeys.inWorkspace(workspacePath, 'branches', filter);
}

export function labelsKey(workspacePath: string, filter: QueryFilter) {
  return queryKeys.inWorkspace(workspacePath, 'labels', filter);
}

export function changesetsKey(workspacePath: string, filter: QueryFilter) {
  return queryKeys.inWorkspace(workspacePath, 'changesets', filter);
}

export function shelvesKey(workspacePath: string, filter: QueryFilter) {
  return queryKeys.inWorkspace(workspacePath, 'shelves', filter);
}
