import { useQuery } from '@tanstack/react-query';
import type { RevisionRef } from '@shared/domain/revision';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { useWorkspacePath } from '../../app/workspace/useWorkspace';

/** `revision`: the history of the item it is a revision of (in its repository), rather than of the workspace's file. */
export function useItemHistory(path: string, revision?: RevisionRef) {
  const workspacePath = useWorkspacePath();
  return useQuery({
    queryKey: queryKeys.inWorkspace(workspacePath, 'history', path, revision),
    queryFn: () => api.history.forItem(workspacePath, path, revision),
  });
}
