import type { Shelve } from '@shared/domain/shelve';
import { queryKeys } from '../../api/queryKeys';
import { queryClient } from '../../app/queryClient';

/** The shelve from any list of shelves already read, so a page opened from one reads nothing more. */
export function cachedShelve(workspacePath: string, shelveId: number): Shelve | undefined {
  for (const [, data] of queryClient.getQueriesData<Shelve[]>({ queryKey: queryKeys.inWorkspace(workspacePath, 'shelves') })) {
    const found = data?.find((shelve) => shelve.id === shelveId);
    if (found) return found;
  }
  return undefined;
}
