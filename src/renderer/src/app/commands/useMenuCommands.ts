import { useUvcsEvent } from '../../api/useUvcsEvent';
import { isModalDialogOpen } from '../../lib/modalDialog';
import { allCommands } from './commandStore';

/** Runs the registered command a native menu item asks for (`runMenuCommand`). */
export function useMenuCommands(): void {
  useUvcsEvent('menuCommand', ({ commandId }) => runMenuCommand(commandId));
}

/** Runs the registered command with this id. Items whose command isn't available, or asked for behind a modal dialog, do nothing. */
export function runMenuCommand(commandId: string, root?: Parameters<typeof isModalDialogOpen>[0]): void {
  if (isModalDialogOpen(root)) return;
  const command = allCommands().find((candidate) => candidate.id === commandId);
  if (command && !command.disabled) command.run();
}
