import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { useWorkspacePath } from '../../app/workspace/useWorkspace';

/** `changesetId`: the item at that repository path in that changeset, rather than in the workspace. */
export function useItemHistory(path: string, changesetId?: number) {
  const workspacePath = useWorkspacePath();
  return useQuery({
    queryKey: queryKeys.inWorkspace(workspacePath, 'history', path, changesetId),
    queryFn: () => api.history.forItem(workspacePath, path, changesetId),
  });
}
