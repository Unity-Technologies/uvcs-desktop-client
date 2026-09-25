import { useUvcsEvent } from '../../api/useUvcsEvent';
import { allCommands } from './commandStore';

/** Runs the registered command a native menu item asks for. Items whose command isn't available do nothing. */
export function useMenuCommands(): void {
  useUvcsEvent('menuCommand', ({ commandId }) => {
    const command = allCommands().find((candidate) => candidate.id === commandId);
    if (command && !command.disabled) command.run();
  });
}
