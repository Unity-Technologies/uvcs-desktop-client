import { api } from '../../api/client';
import { toast } from '../../ui/toast/toastStore';
import { openCreateWorkspaceDialog } from '../home/dialogs/CreateWorkspaceDialog';
import type { DroppedFolder } from './droppedFolder';

interface DropTarget {
  /** Shift was held on the drop: the workspace opens in a new window (or the one already showing it comes forward). */
  newWindow: boolean;
  /** The workspace this window shows; null on the home screen. */
  currentWorkspace: string | null;
  /** Opens a workspace in this window. */
  openHere: (path: string) => void;
}

/**
 * Opens the workspace a dropped folder belongs to, or offers to create a workspace in it. `workspaces.findRoot` is a
 * local `cm getworkspacefrompath` (it reads the `.plastic` folders on disk, never the server) and also finds the
 * workspace of a folder inside one. As in the official client, a folder that is no workspace goes straight to the new
 * workspace dialog, its location filled in: dropping it on the window already said "open or create".
 */
export async function openDroppedFolder(dropped: DroppedFolder, { newWindow, currentWorkspace, openHere }: DropTarget): Promise<void> {
  if (dropped.kind === 'severalItems') {
    toast.info('Drop one folder at a time');
    return;
  }
  if (dropped.kind === 'notAFolder') {
    toast.info('Drop a folder', 'A workspace opens from its folder, or from any folder inside it.');
    return;
  }
  const open = newWindow ? (path: string) => void api.windows.openWorkspace(path) : openHere;
  const workspaceRoot = await api.workspaces.findRoot(dropped.path);
  if (!workspaceRoot) {
    openCreateWorkspaceDialog({ path: dropped.path, onCreated: open });
    return;
  }
  if (!newWindow && workspaceRoot === currentWorkspace) return;
  open(workspaceRoot);
}
