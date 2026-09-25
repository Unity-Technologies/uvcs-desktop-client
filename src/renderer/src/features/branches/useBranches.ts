import { useQuery } from '@tanstack/react-query';
import type { QueryFilter } from '@shared/domain/query';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { SLOW_CHANGING_QUERY } from '../../app/queryClient';
import { useWorkspacePath } from '../../app/workspace/useWorkspace';
import { compactFilter } from '../../lib/compactFilter';

/** Branches matching `filter`. Without one, every branch: tens of thousands on big repositories, so read rarely. */
export function useBranches(filter: QueryFilter = {}) {
  const workspacePath = useWorkspacePath();
  // `{ includeHidden: false }` and `{}` ask for the same branches: one cache entry, one `cm find`.
  const query = compactFilter(filter);
  return useQuery({
    queryKey: queryKeys.inWorkspace(workspacePath, 'branches', query),
    queryFn: () => api.branches.list(workspacePath, query),
    placeholderData: (previous) => previous,
    ...SLOW_CHANGING_QUERY,
  });
}

/** One branch by name, without reading the whole list. */
export function useBranch(name: string) {
  const workspacePath = useWorkspacePath();
  return useQuery({
    queryKey: queryKeys.inWorkspace(workspacePath, 'branches', 'byName', name),
    queryFn: () => api.branches.get(workspacePath, name),
    ...SLOW_CHANGING_QUERY,
  });
}
