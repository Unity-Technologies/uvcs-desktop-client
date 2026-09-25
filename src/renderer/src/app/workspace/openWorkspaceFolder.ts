import { api } from '../../api/client';
import { toast } from '../../ui/toast/toastStore';

/** Asks for a folder and opens the workspace it belongs to. */
export async function openWorkspaceFolder(open: (path: string) => void): Promise<void> {
  const directory = await api.system.pickDirectory('Open a workspace folder');
  if (!directory) return;
  const root = await api.workspaces.findRoot(directory);
  if (root) open(root);
  else toast.error('That folder is not inside a workspace', 'Drop it on the home screen to create a workspace there.');
}
