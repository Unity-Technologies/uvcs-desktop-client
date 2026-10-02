import { api } from '../../api/client';
import { copyToClipboard } from '../../ui/copyToClipboard';
import { toast } from '../../ui/toast/toastStore';

/** Opens the user's terminal in the workspace folder, e.g. to start an agent there. */
export function openTerminalIn(workspacePath: string): void {
  api.apps.openInTerminal(workspacePath).catch((error: unknown) => toast.error("Couldn't open a terminal", error));
}

/** Shows the workspace folder selected in the file manager, as every other item is revealed. */
export function revealWorkspace(workspacePath: string): void {
  void api.system.revealInFileManager(workspacePath);
}

export function copyWorkspacePath(workspacePath: string): void {
  copyToClipboard(workspacePath, 'Workspace path');
}
