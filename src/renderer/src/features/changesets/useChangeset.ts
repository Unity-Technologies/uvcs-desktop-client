import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { useWorkspacePath } from '../../app/workspace/useWorkspace';

export function useChangeset(changesetId: number | null) {
  const workspacePath = useWorkspacePath();
  return useQuery({
    queryKey: queryKeys.inWorkspace(workspacePath, 'changesets', 'byId', changesetId),
    queryFn: () => api.changesets.get(workspacePath, changesetId!),
    enabled: changesetId !== null,
  });
}
