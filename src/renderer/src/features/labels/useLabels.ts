import { useQuery } from '@tanstack/react-query';
import type { Place } from '@shared/domain/place';
import type { QueryFilter } from '@shared/domain/query';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { SLOW_CHANGING_QUERY } from '../../app/queryClient';
import { usePlace } from '../../app/workspace/useWorkspace';
import { compactFilter } from '../../lib/compactFilter';

/** Labels matching `filter`; `of` reads another place's than the window's, e.g. an xlinked repository's (`repositoryPlace`). */
export function useLabels(filter: QueryFilter = {}, of?: Place) {
  const windowPlace = usePlace();
  const place = of ?? windowPlace;
  // Equivalent filters (no owners, no date) share one cache entry and one `cm find`.
  const query = compactFilter(filter);
  return useQuery({
    queryKey: queryKeys.inPlace(place, 'labels', query),
    queryFn: () => api.labels.list(place, query),
    placeholderData: (previous) => previous,
    // Without a filter, every label (thousands on big repositories), which only change by label operations.
    ...SLOW_CHANGING_QUERY,
  });
}
