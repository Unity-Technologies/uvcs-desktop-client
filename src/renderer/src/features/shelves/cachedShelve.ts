import type { Shelve } from '@shared/domain/shelve';
import { queryKeys } from '../../api/queryKeys';
import { queryClient } from '../../app/queryClient';

/** The shelve from any list of shelves already read, so a page opened from one reads nothing more. */
export function cachedShelve(workspacePath: string, shelveId: number): Shelve | undefined {
  return listedShelve(workspacePath, shelveId)?.shelve;
}

/** The shelve from a list of shelves already read, and when that list was read. */
export function listedShelve(workspacePath: string, shelveId: number): { shelve: Shelve; readAt: number } | undefined {
  for (const query of queryClient.getQueryCache().findAll({ queryKey: queryKeys.inWorkspace(workspacePath, 'shelves') })) {
    const found = Array.isArray(query.state.data) ? (query.state.data as Shelve[]).find((shelve) => shelve.id === shelveId) : undefined;
    if (found) return { shelve: found, readAt: query.state.dataUpdatedAt };
  }
  return undefined;
}
