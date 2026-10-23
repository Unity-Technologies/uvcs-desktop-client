import { useQuery } from '@tanstack/react-query';
import type { QueryFilter } from '@shared/domain/query';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { SLOW_CHANGING_QUERY } from '../../app/queryClient';
import { useWorkspacePath } from '../../app/workspace/useWorkspace';
import { compactFilter } from '../../lib/compactFilter';

/** Labels matching `filter`; `repository` (`name@server`) reads another repository's than the workspace's, an xlinked one's. */
export function useLabels(filter: QueryFilter = {}, repository?: string) {
  const workspacePath = useWorkspacePath();
  // Equivalent filters (no owners, no date) share one cache entry and one `cm find`.
  const query = compactFilter(filter);
  return useQuery({
    queryKey: queryKeys.objectList(workspacePath, 'labels', query, repository),
    queryFn: () => api.labels.list(workspacePath, query, ...(repository ? [repository] : [])),
    placeholderData: (previous) => previous,
    // Without a filter, every label (thousands on big repositories), which only change by label operations.
    ...SLOW_CHANGING_QUERY,
  });
}
