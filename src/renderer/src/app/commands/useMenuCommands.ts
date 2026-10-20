import { api } from '../../api/client';
import { useUvcsEvent } from '../../api/useUvcsEvent';
import { isModalDialogOpen } from '../../lib/modalDialog';
import { usePageWindow } from '../pageWindow/pageWindowStore';
import { allCommands, type Command } from './commandStore';

/**
 * Runs the registered command a native menu item asks for (`runMenuCommand`). A page window has none of its
 * workspace's commands (Switch branch, Update workspace…): its workspace window comes forward and runs them.
 */
export function useMenuCommands(): void {
  useUvcsEvent('menuCommand', ({ commandId }) => {
    if (menuCommandTarget(commandId, allCommands(), usePageWindow.getState().isPageWindow) === 'workspaceWindow') {
      void api.windows.showWorkspaceWindow(commandId);
    } else {
      runMenuCommand(commandId);
    }
  });
}

/**
 * Where a menu bar command runs: in this window when it has the command (a view's in a page window: it sends that on
 * itself), else in a page window's workspace window, which has the workspace's commands.
 */
export function menuCommandTarget(commandId: string, commands: readonly Pick<Command, 'id'>[], isPageWindow: boolean): 'here' | 'workspaceWindow' {
  const registered = commands.some((command) => command.id === commandId);
  return isPageWindow && !registered ? 'workspaceWindow' : 'here';
}

/** Runs the registered command with this id. Items whose command isn't available, or asked for behind a modal dialog, do nothing. */
export function runMenuCommand(commandId: string, root?: Parameters<typeof isModalDialogOpen>[0]): void {
  if (isModalDialogOpen(root)) return;
  const command = allCommands().find((candidate) => candidate.id === commandId);
  if (command && !command.disabled) command.run();
}
