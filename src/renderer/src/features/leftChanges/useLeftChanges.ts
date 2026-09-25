import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { useWorkspaceInfo, useWorkspacePath } from '../../app/workspace/useWorkspace';

const POLL_INTERVAL_MS = 60_000;

/**
 * Changes left on what the workspace is on now, waiting to be restored. Looked up again when the selector
 * changes, on focus and every minute (shelves can be left or deleted by other apps).
 */
export function useLeftChanges() {
  const workspacePath = useWorkspacePath();
  const { data: workspace } = useWorkspaceInfo();
  return useQuery({
    queryKey: queryKeys.inWorkspace(workspacePath, 'leftChanges', workspace?.selector),
    queryFn: () => api.leftChanges.find(workspacePath),
    enabled: Boolean(workspace),
    refetchInterval: POLL_INTERVAL_MS,
    refetchOnWindowFocus: true,
  });
}

/** Whether changes are waiting to be restored, for the dot on Changes. */
export function useHasLeftChanges(): boolean {
  return (useLeftChanges().data?.length ?? 0) > 0;
}
