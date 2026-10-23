import type { Place } from '@shared/domain/place';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { IMMUTABLE_QUERY } from '../../app/queryClient';

/**
 * A folder of the repository's tree at a changeset (`''` is the root). What a changeset holds never changes, so each
 * folder is read once: refreshes and window focus skip it.
 */
export function repositoryListingQuery(place: Place, changesetId: number, directory: string) {
  return {
    queryKey: queryKeys.inPlace(place, 'explorer', 'repositoryDirectory', changesetId, directory),
    queryFn: () => api.explorer.listRepositoryDirectory(place, changesetId, directory),
    staleTime: Infinity,
    meta: IMMUTABLE_QUERY,
  };
}
