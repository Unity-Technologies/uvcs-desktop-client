import { useQuery } from '@tanstack/react-query';
import type { QueryFilter } from '@shared/domain/query';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { useWorkspacePath } from '../../app/workspace/useWorkspace';

export function useBranches(filter: QueryFilter = {}) {
  const workspacePath = useWorkspacePath();
  return useQuery({
    queryKey: queryKeys.inWorkspace(workspacePath, 'branches', filter),
    queryFn: () => api.branches.list(workspacePath, filter),
    placeholderData: (previous) => previous,
  });
}
