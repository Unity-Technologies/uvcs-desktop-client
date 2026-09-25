import { Command as CommandIcon, Settings } from 'lucide-react';
import { useMemo } from 'react';
import { openSettingsDialog } from '../settings/SettingsDialog';
import { useCommandPalette } from './commandPaletteStore';
import { useCommands, type Command } from './commandStore';

/** Commands available everywhere, including the home screen. */
export function useAppCommands(): void {
  const commands = useMemo<Command[]>(
    () => [
      { id: 'app.settings', group: 'App', label: 'Settings', icon: Settings, shortcut: 'mod+,', run: openSettingsDialog },
      {
        id: 'app.commandPalette',
        group: 'App',
        label: 'Show command palette',
        icon: CommandIcon,
        run: () => useCommandPalette.getState().setOpen(true),
      },
    ],
    [],
  );
  useCommands(commands);
}
