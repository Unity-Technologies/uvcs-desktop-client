import { AppWindow, Command as CommandIcon, Info, Keyboard, PanelLeft, RefreshCw, Settings } from 'lucide-react';
import { useMemo } from 'react';
import { api } from '../../api/client';
import { openAboutDialog } from '../about/AboutDialog';
import { openSettingsDialog } from '../settings/SettingsDialog';
import { checkForUpdates } from '../updates/updateStore';
import { SIDEBAR_SHORTCUT, toggleSidebar, useSidebarCollapsed } from '../shell/sidebarStore';
import { useCommandPalette } from './commandPaletteStore';
import { useCommands, type Command } from './commandStore';
import { openShortcutsDialog } from './ShortcutsDialog';
import { hotkey, hotkeys } from '../../lib/shortcutRegistry';
import { useShortcut } from '../../lib/useShortcut';

/** Commands available everywhere, including the home screen. */
export function useAppCommands(): void {
  const rail = useSidebarCollapsed();
  const commands = useMemo<Command[]>(
    () => [
      { id: 'app.settings', group: 'App', label: 'Settings', icon: Settings, shortcut: hotkey('settings'), run: openSettingsDialog },
      {
        id: 'app.commandPalette',
        group: 'App',
        label: 'Show command palette',
        icon: CommandIcon,
        run: () => useCommandPalette.getState().setOpen(true),
      },
      {
        id: 'app.shortcuts',
        group: 'App',
        label: 'Keyboard shortcuts',
        icon: Keyboard,
        keywords: ['keys', 'hotkeys', 'help'],
        shortcut: hotkey('shortcuts'),
        run: openShortcutsDialog,
      },
      {
        id: 'app.sidebar',
        group: 'App',
        label: rail ? 'Expand sidebar' : 'Collapse sidebar',
        icon: PanelLeft,
        keywords: ['rail', 'collapse', 'expand', 'navigation'],
        shortcut: SIDEBAR_SHORTCUT,
        run: toggleSidebar,
      },
      {
        id: 'app.newWindow',
        group: 'App',
        label: 'New window',
        icon: AppWindow,
        keywords: ['window'],
        shortcut: hotkey('newWindow'),
        run: () => void api.windows.openHome(),
      },
      { id: 'app.about', group: 'App', label: 'About Unity Version Control', icon: Info, keywords: ['version'], run: openAboutDialog },
      {
        id: 'app.checkForUpdates',
        group: 'App',
        label: 'Check for updates',
        icon: RefreshCw,
        keywords: ['upgrade', 'version', 'new'],
        run: () => void checkForUpdates(),
      },
    ],
    [rail],
  );
  useCommands(commands);
  // The sheet's other key (⌘/): a command runs from one key.
  useShortcut(hotkeys('shortcuts')[1], openShortcutsDialog);
}
