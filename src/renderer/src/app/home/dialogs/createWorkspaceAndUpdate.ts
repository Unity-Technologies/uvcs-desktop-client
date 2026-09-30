import type { CreateWorkspaceRequest } from '@shared/api/workspaces';
import { api } from '../../../api/client';
import { queryKeys } from '../../../api/queryKeys';
import { queryClient } from '../../queryClient';
import { updateWorkspace } from '../../shell/workspaceOperations';

/**
 * Creates a workspace, opens it, then downloads the latest files of /main into it with the workspace's own Update
 * (`updateWorkspace`: its progress card, status bar and refreshes). `cm workspace create` already puts a workspace on
 * /main with nothing loaded, so no switch is needed. A failed create rejects, before anything opens; a failed update
 * leaves the workspace created and open, reported as any update is.
 */
export async function createWorkspaceAndUpdate(request: CreateWorkspaceRequest, open: (workspacePath: string) => void): Promise<void> {
  const created = await api.workspaces.create(request);
  void queryClient.invalidateQueries({ queryKey: queryKeys.workspaces });
  open(created.path);
  await updateWorkspace(created.path);
}
