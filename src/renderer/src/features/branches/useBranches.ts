import { useQuery } from '@tanstack/react-query';
import type { Place } from '@shared/domain/place';
import type { QueryFilter } from '@shared/domain/query';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { keyedByWorkspaceInfo, queryClient, SLOW_CHANGING_QUERY } from '../../app/queryClient';
import { usePlace } from '../../app/workspace/useWorkspace';
import { compactFilter } from '../../lib/compactFilter';

/**
 * Branches matching `filter`. Without one, every branch: tens of thousands on big repositories, so read rarely. `of`
 * reads another place's than the window's, e.g. an xlinked repository's (`repositoryPlace`).
 */
export function useBranches(filter: QueryFilter = {}, of?: Place) {
  const windowPlace = usePlace();
  const place = of ?? windowPlace;
  // `{ includeHidden: false }` and `{}` ask for the same branches: one cache entry, one `cm find`.
  const query = compactFilter(filter);
  return useQuery({
    queryKey: queryKeys.inPlace(place, 'branches', query),
    queryFn: () => api.branches.list(place, query),
    placeholderData: (previous) => previous,
    ...SLOW_CHANGING_QUERY,
  });
}

/** One branch by name, without reading the whole list. */
export function useBranch(name: string) {
  return useQuery({ ...branchQuery(usePlace(), name), ...SLOW_CHANGING_QUERY });
}

/** The same branch for code outside components; shares the cache (and a read in flight) with `useBranch`. */
export function fetchBranch(place: Place, name: string) {
  return queryClient.fetchQuery({ ...branchQuery(place, name), staleTime: SLOW_CHANGING_QUERY.staleTime });
}

export function branchQuery(place: Place, name: string) {
  return {
    queryKey: queryKeys.inPlace(place, 'branches', 'byName', name),
    queryFn: () => api.branches.get(place, name),
    // Views show the branch the workspace is on (its comment, whether it is a finished task): once it switches away,
    // the old branch isn't read again, only marked stale.
    meta: keyedByWorkspaceInfo('selector'),
  };
}
