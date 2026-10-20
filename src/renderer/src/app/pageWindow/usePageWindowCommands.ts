import { useMemo } from 'react';
import { api } from '../../api/client';
import { useCommands, type Command } from '../commands/commandStore';
import { VIEWS } from '../navigation/viewRegistry';

/**
 * A page window shows no views: going to one (⌘1…, the palette) brings its workspace window forward on that view.
 * The menu bar's workspace commands go there the same way (`useMenuCommands`).
 */
export function usePageWindowCommands(): void {
  const commands = useMemo<Command[]>(
    () =>
      VIEWS.map((view) => ({
        id: `goto.${view.id}`,
        group: 'Go to',
        label: view.label,
        icon: view.icon,
        shortcut: view.shortcut,
        run: () => void api.windows.showWorkspaceWindow(`goto.${view.id}`),
      })),
    [],
  );
  useCommands(commands);
}
