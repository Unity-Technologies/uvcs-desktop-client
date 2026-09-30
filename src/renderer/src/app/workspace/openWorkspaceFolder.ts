import { api } from '../../api/client';
import { confirm } from '../../ui/dialog/confirm';
import { openCreateWorkspaceDialog } from '../home/dialogs/CreateWorkspaceDialog';

/** Asks for a folder and opens the workspace it belongs to, or offers to create one there. */
export async function openWorkspaceFolder(open: (path: string) => void): Promise<void> {
  const directory = await api.system.pickDirectory('Open a workspace folder');
  if (directory) await openFolder(directory, open);
}

/** Opens the workspace a picked folder belongs to, or offers to create a workspace there (a drop: `openDroppedFolder`). */
export async function openFolder(folder: string, open: (path: string) => void): Promise<void> {
  const workspaceRoot = await api.workspaces.findRoot(folder);
  if (workspaceRoot) {
    open(workspaceRoot);
    return;
  }
  const create = await confirm({
    title: 'This folder is not a workspace',
    message: `Create a workspace in ${folder} to version its files?`,
    confirmLabel: 'Create workspace…',
  });
  if (create) openCreateWorkspaceDialog({ path: folder, onCreated: open });
}
