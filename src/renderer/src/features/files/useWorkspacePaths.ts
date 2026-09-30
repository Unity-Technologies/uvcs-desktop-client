import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';

function workspacePathsKey(workspacePath: string) {
  return queryKeys.inWorkspace(workspacePath, 'explorer', 'allPaths');
}

/**
 * Every path in the workspace, for "go to file" searches. Kept until files are added, deleted or moved
 * (see `useWorkspaceWatcher`), so editing files never re-reads the tree, and a stale list shows while it is re-read.
 */
export function useWorkspacePaths(workspacePath: string, enabled = true) {
  return useQuery({
    queryKey: workspacePathsKey(workspacePath),
    queryFn: () => api.explorer.listAllPaths(workspacePath),
    staleTime: Infinity,
    gcTime: 30 * 60_000,
    enabled,
  });
}
