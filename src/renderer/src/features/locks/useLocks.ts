import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { useWorkspaceInfo, useWorkspacePath } from '../../app/workspace/useWorkspace';

export function useLocks(onlyMine: boolean) {
  const workspacePath = useWorkspacePath();
  const repository = useWorkspaceInfo().data?.repository;
  return useQuery({
    queryKey: queryKeys.inWorkspace(workspacePath, 'locks', repository, onlyMine),
    queryFn: () => api.locks.list(workspacePath, repository!, { onlyMine }),
    enabled: Boolean(repository),
    placeholderData: (previous) => previous,
  });
}
