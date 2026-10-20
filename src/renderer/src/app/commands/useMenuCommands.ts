import { api } from '../../api/client';
import { useUvcsEvent } from '../../api/useUvcsEvent';
import { isModalDialogOpen } from '../../lib/modalDialog';
import { usePageWindow } from '../pageWindow/pageWindowStore';
import { allCommands } from './commandStore';

/**
 * Runs the registered command a native menu item asks for (`runMenuCommand`). A page window has none of its
 * workspace's commands (Switch branch, Update workspace…): its workspace window comes forward and runs them.
 */
export function useMenuCommands(): void {
  useUvcsEvent('menuCommand', ({ commandId }) => {
    const registered = allCommands().some((command) => command.id === commandId);
    if (!registered && usePageWindow.getState().isPageWindow) void api.windows.showWorkspaceWindow(commandId);
    else runMenuCommand(commandId);
  });
}

/** Runs the registered command with this id. Items whose command isn't available, or asked for behind a modal dialog, do nothing. */
export function runMenuCommand(commandId: string, root?: Parameters<typeof isModalDialogOpen>[0]): void {
  if (isModalDialogOpen(root)) return;
  const command = allCommands().find((candidate) => candidate.id === commandId);
  if (command && !command.disabled) command.run();
}
