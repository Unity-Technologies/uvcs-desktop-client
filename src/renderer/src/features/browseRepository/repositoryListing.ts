import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { IMMUTABLE_QUERY } from '../../app/queryClient';

/**
 * A folder of the repository's tree at a changeset (`''` is the root). What a changeset holds never changes, so each
 * folder is read once: refreshes and window focus skip it.
 */
export function repositoryListingQuery(workspacePath: string, changesetId: number, directory: string) {
  return {
    queryKey: queryKeys.inWorkspace(workspacePath, 'explorer', 'repositoryDirectory', changesetId, directory),
    queryFn: () => api.explorer.listRepositoryDirectory(workspacePath, changesetId, directory),
    staleTime: Infinity,
    meta: IMMUTABLE_QUERY,
  };
}
