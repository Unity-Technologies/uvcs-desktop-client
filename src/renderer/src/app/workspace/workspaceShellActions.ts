import { api } from '../../api/client';
import { copyToClipboard } from '../../lib/copyToClipboard';
import { toast } from '../../ui/toast/toastStore';

/** Opens the user's terminal in the workspace folder, e.g. to start an agent there. */
export function openTerminalIn(workspacePath: string): void {
  api.system.openTerminal(workspacePath).catch((error: unknown) => toast.error("Couldn't open a terminal", error));
}

export function copyWorkspacePath(workspacePath: string): void {
  copyToClipboard(workspacePath, 'Workspace path');
}
