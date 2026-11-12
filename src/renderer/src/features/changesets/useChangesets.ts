import { useQuery } from '@tanstack/react-query';
import type { QueryFilter } from '@shared/domain/query';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { usePlace } from '../../app/workspace/useWorkspace';
import { compactFilter } from '../../lib/compactFilter';

/** `enabled` false reads nothing, for a view that needs a branch's changesets only for some targets (a review of a branch). */
export function useChangesets(filter: QueryFilter = {}, { enabled = true }: { enabled?: boolean } = {}) {
  const place = usePlace();
  // Equivalent filters (no owners, no date) share one cache entry and one `cm find`.
  const query = compactFilter(filter);
  return useQuery({
    queryKey: queryKeys.inPlace(place, 'changesets', query),
    queryFn: () => api.changesets.list(place, query),
    placeholderData: (previous) => previous,
    enabled,
  });
}
