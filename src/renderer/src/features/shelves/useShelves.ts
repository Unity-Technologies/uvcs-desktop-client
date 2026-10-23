import { useQuery } from '@tanstack/react-query';
import type { QueryFilter } from '@shared/domain/query';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { usePlace } from '../../app/workspace/useWorkspace';
import { compactFilter } from '../../lib/compactFilter';

export function useShelves(filter: QueryFilter = {}) {
  const place = usePlace();
  // Equivalent filters (no owners, no date) share one cache entry and one `cm find`.
  const query = compactFilter(filter);
  return useQuery({
    queryKey: queryKeys.inPlace(place, 'shelves', query),
    queryFn: () => api.shelves.list(place, query),
    placeholderData: (previous) => previous,
  });
}
