import { api } from '../../api/client';
import { useUvcsEvent } from '../../api/useUvcsEvent';
import { isModalDialogOpen } from '../../lib/modalDialog';
import { navigation } from '../navigation/navigationStore';
import { viewOfListCommand, viewShownIn } from '../navigation/views';
import { useSession } from '../workspace/sessionStore';
import { usePageWindow } from '../pageWindow/pageWindowStore';
import { commandsWhileCovered, useSignInCover } from '../signIn/coveredCommands';
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

/**
 * Runs the registered command with this id, or shows the list of the view a page window asked for
 * (`viewListCommandId`). Items whose command isn't available, asked for behind a modal dialog, or of a place the
 * sign-in screen covers (`commandsWhileCovered`), do nothing.
 */
export function runMenuCommand(commandId: string, root?: Parameters<typeof isModalDialogOpen>[0]): void {
  if (isModalDialogOpen(root)) return;
  const covered = useSignInCover.getState().covered;
  const listOf = viewOfListCommand(commandId);
  // A view's list is the place's: off while the sign-in screen covers it, as its commands are.
  if (listOf && covered) return;
  if (listOf) {
    // A view's list for a place shown; on the home screen, where no place is, there is no view to show.
    const place = useSession.getState().place;
    if (place) navigation.goToView(viewShownIn(place, listOf));
    return;
  }
  const command = commandsWhileCovered(allCommands(), covered).find((candidate) => candidate.id === commandId);
  if (command && !command.disabled) command.run();
}
