import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { keyedByWorkspaceInfo, SLOW_CHANGING_QUERY } from '../../app/queryClient';
import { useWorkspaceInfo, useWorkspacePath } from '../../app/workspace/useWorkspace';

/**
 * Changes left on what the workspace is on now, waiting to be restored. Keyed by the selector, so they are looked up
 * again whenever the workspace moves (whoever switched it: the workspace info follows `.plastic`). Never polled:
 * this app's switches and restores refresh it, and shelves left or deleted by other apps show within five minutes.
 */
export function useLeftChanges() {
  const workspacePath = useWorkspacePath();
  const { data: workspace } = useWorkspaceInfo();
  return useQuery({
    queryKey: queryKeys.inWorkspace(workspacePath, 'leftChanges', workspace?.selector),
    queryFn: () => api.leftChanges.find(workspacePath),
    enabled: Boolean(workspace),
    staleTime: SLOW_CHANGING_QUERY.staleTime,
    meta: keyedByWorkspaceInfo('selector'),
  });
}

/** Whether changes are waiting to be restored, for the dot on Changes. */
export function useHasLeftChanges(): boolean {
  return (useLeftChanges().data?.length ?? 0) > 0;
}
