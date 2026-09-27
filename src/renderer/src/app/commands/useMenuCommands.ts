import { useUvcsEvent } from '../../api/useUvcsEvent';
import { isModalDialogOpen } from '../../lib/modalDialog';
import { allCommands } from './commandStore';

/** Runs the registered command a native menu item asks for. Items whose command isn't available, or asked for behind a modal dialog, do nothing. */
export function useMenuCommands(): void {
  useUvcsEvent('menuCommand', ({ commandId }) => {
    if (isModalDialogOpen()) return;
    const command = allCommands().find((candidate) => candidate.id === commandId);
    if (command && !command.disabled) command.run();
  });
}
