import { AppWindow, Command as CommandIcon, PanelLeft, Settings } from 'lucide-react';
import { useMemo } from 'react';
import { api } from '../../api/client';
import { openSettingsDialog } from '../settings/SettingsDialog';
import { SIDEBAR_SHORTCUT, toggleSidebar } from '../shell/sidebarStore';
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
      {
        id: 'app.sidebar',
        group: 'App',
        label: 'Toggle sidebar',
        icon: PanelLeft,
        keywords: ['rail', 'collapse', 'expand', 'navigation'],
        shortcut: SIDEBAR_SHORTCUT,
        run: toggleSidebar,
      },
      { id: 'app.newWindow', group: 'App', label: 'New window', icon: AppWindow, keywords: ['window'], run: () => void api.windows.openHome() },
    ],
    [],
  );
  useCommands(commands);
}
