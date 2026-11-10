import type { RepositoryTreePoint } from '@shared/domain/explorer';
import type { Place } from '@shared/domain/place';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { IMMUTABLE_QUERY } from '../../app/queryClient';

/**
 * A folder of the repository's tree (`''` is the root). What a changeset holds never changes, so its folders are read
 * once: refreshes and window focus skip them. A branch's head moves as the branch gets changesets, so its folders are
 * read again like any other list.
 */
export function repositoryListingQuery(place: Place, tree: RepositoryTreePoint, directory: string) {
  const immutable = tree.kind === 'changeset';
  return {
    queryKey: queryKeys.inPlace(place, 'explorer', 'repositoryDirectory', tree, directory),
    queryFn: () => api.explorer.listRepositoryDirectory(place, tree, directory),
    ...(immutable ? { staleTime: Infinity, meta: IMMUTABLE_QUERY } : {}),
  };
}
