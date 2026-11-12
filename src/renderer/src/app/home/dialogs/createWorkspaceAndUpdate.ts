import type { CreateWorkspaceRequest } from '@shared/api/workspaces';
import { api } from '../../../api/client';
import { queryKeys } from '../../../api/queryKeys';
import { openChooseDownloads } from '../../../features/partialWorkspace/ChooseDownloadsDialog';
import { queryClient } from '../../queryClient';
import { updateWorkspace } from '../../shell/workspaceOperations';

/**
 * Creates a workspace, opens it, then downloads the latest files of /main into it with the workspace's own Update
 * (`updateWorkspace`: its progress card, status bar and refreshes). `cm workspace create` already puts a workspace on
 * /main with nothing loaded, so no switch is needed. A dynamic workspace isn't updated: it shows /main's files as soon
 * as it's mounted, and downloads each one when it's first opened. A partial workspace is created empty and never
 * updated, since an Update would download everything and make it standard: the user chooses what to download instead
 * (`openChooseDownloads`). A failed create rejects, before anything opens; a failed update leaves the workspace created
 * and open, reported as any update is.
 */
export async function createWorkspaceAndUpdate(request: CreateWorkspaceRequest, open: (workspacePath: string) => void): Promise<void> {
  const created = await api.workspaces.create(request);
  void queryClient.invalidateQueries({ queryKey: queryKeys.workspaces });
  open(created.path);
  if (request.kind === 'partial') openChooseDownloads(created.path);
  else if (request.kind !== 'dynamic') await updateWorkspace(created.path);
}
