import { api } from '../../api/client';
import { copyToClipboard } from '../../ui/copyToClipboard';
import { toast } from '../../ui/toast/toastStore';

/** Opens the user's terminal in the workspace folder, e.g. to start an agent there. */
export function openTerminalIn(workspacePath: string): void {
  api.apps.openInTerminal(workspacePath).catch((error: unknown) => toast.error("Couldn't open a terminal", error));
}

/**
 * Opens the workspace folder in the file manager, showing what it holds. Unlike the items inside it, which are revealed
 * selected in their folder, the workspace isn't shown in its parent: that folder isn't the workspace's.
 */
export function openWorkspaceInFileManager(workspacePath: string): void {
  api.system.openPath(workspacePath).catch((error: unknown) => toast.error("Couldn't open the workspace folder", error));
}

export function copyWorkspacePath(workspacePath: string): void {
  copyToClipboard(workspacePath, 'Workspace path');
}
