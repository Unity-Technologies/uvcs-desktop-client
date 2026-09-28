import { useQuery } from '@tanstack/react-query';
import type { QueryFilter } from '@shared/domain/query';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { useWorkspacePath } from '../../app/workspace/useWorkspace';
import { compactFilter } from '../../lib/compactFilter';

export function useShelves(filter: QueryFilter = {}) {
  const workspacePath = useWorkspacePath();
  // Equivalent filters (no owners, no date) share one cache entry and one `cm find`.
  const query = compactFilter(filter);
  return useQuery({
    queryKey: queryKeys.inWorkspace(workspacePath, 'shelves', query),
    queryFn: () => api.shelves.list(workspacePath, query),
    placeholderData: (previous) => previous,
  });
}
