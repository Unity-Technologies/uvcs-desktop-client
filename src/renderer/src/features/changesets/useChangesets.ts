import { useQuery } from '@tanstack/react-query';
import type { QueryFilter } from '@shared/domain/query';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { useWorkspacePath } from '../../app/workspace/useWorkspace';

export function useChangesets(filter: QueryFilter = {}) {
  const workspacePath = useWorkspacePath();
  return useQuery({
    queryKey: queryKeys.inWorkspace(workspacePath, 'changesets', filter),
    queryFn: () => api.changesets.list(workspacePath, filter),
    placeholderData: (previous) => previous,
  });
}
