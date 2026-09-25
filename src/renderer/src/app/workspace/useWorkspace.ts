import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { useSession } from './sessionStore';

/** The path of the open workspace. Only use it inside the workspace screen. */
export function useWorkspacePath(): string {
  const workspacePath = useSession((state) => state.workspacePath);
  if (!workspacePath) throw new Error('No workspace is open.');
  return workspacePath;
}

export function useWorkspaceInfo() {
  const workspacePath = useWorkspacePath();
  return useQuery({
    queryKey: queryKeys.inWorkspace(workspacePath, 'info'),
    queryFn: () => api.workspaces.info(workspacePath),
  });
}

/** Whether the open workspace's folder is gone (deleted, moved, or on a drive that isn't mounted). */
export function useWorkspaceFolderMissing() {
  const workspacePath = useWorkspacePath();
  return useQuery({
    queryKey: queryKeys.inWorkspace(workspacePath, 'folderMissing'),
    queryFn: async () => (await api.workspaces.findMissing([workspacePath])).length > 0,
  });
}
