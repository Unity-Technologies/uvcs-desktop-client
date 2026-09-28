import { useQuery } from '@tanstack/react-query';
import type { QueryFilter } from '@shared/domain/query';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { SLOW_CHANGING_QUERY } from '../../app/queryClient';
import { useWorkspacePath } from '../../app/workspace/useWorkspace';
import { compactFilter } from '../../lib/compactFilter';

export function useLabels(filter: QueryFilter = {}) {
  const workspacePath = useWorkspacePath();
  // Equivalent filters (no owners, no date) share one cache entry and one `cm find`.
  const query = compactFilter(filter);
  return useQuery({
    queryKey: queryKeys.inWorkspace(workspacePath, 'labels', query),
    queryFn: () => api.labels.list(workspacePath, query),
    placeholderData: (previous) => previous,
    // Without a filter, every label (thousands on big repositories), which only change by label operations.
    ...SLOW_CHANGING_QUERY,
  });
}
