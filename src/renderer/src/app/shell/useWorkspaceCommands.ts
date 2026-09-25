import { ArrowDownToLine, FolderOpen, Keyboard, ListChecks, Monitor, Moon, RefreshCw, Sun, TerminalSquare } from 'lucide-react';
import type { ThemePreference } from '@shared/domain/settings';
import { setReviewMode } from '../../features/review/reviewModeSetting';
import type { Icon } from '../../lib/actions';
import { useMemo } from 'react';
import { useCommands, type Command } from '../commands/commandStore';
import { openShortcutsDialog } from '../commands/ShortcutsDialog';
import { navigation } from '../navigation/navigationStore';
import { VIEWS } from '../navigation/viewRegistry';
import { invalidateWorkspace } from '../queryClient';
import { useSettings, useUpdateSettings } from '../settings/useSettings';
import { useSession } from '../workspace/sessionStore';
import { useWorkspacePath } from '../workspace/useWorkspace';
import { useCommandLogStore } from './commandLogStore';
import { updateUnlessUpToDate } from './workspaceOperations';

const THEMES: { theme: ThemePreference; label: string; icon: Icon }[] = [
  { theme: 'system', label: 'Use system theme', icon: Monitor },
  { theme: 'light', label: 'Use light theme', icon: Sun },
  { theme: 'dark', label: 'Use dark theme', icon: Moon },
];

/** Commands available everywhere inside a workspace. */
export function useWorkspaceCommands(): void {
  const workspacePath = useWorkspacePath();
  const closeWorkspace = useSession((state) => state.closeWorkspace);
  const { theme, reviewModeWorkspaces } = useSettings();
  const reviewing = reviewModeWorkspaces.includes(workspacePath);
  const updateSettings = useUpdateSettings();

  const commands = useMemo<Command[]>(
    () => [
      ...VIEWS.map((view) => ({
        id: `goto.${view.id}`,
        group: 'Go to',
        label: view.label,
        icon: view.icon,
        shortcut: view.shortcut,
        run: () => navigation.goToView(view.id),
      })),
      {
        id: 'workspace.update',
        group: 'Workspace',
        label: 'Update workspace',
        icon: ArrowDownToLine,
        shortcut: 'mod+shift+u',
        run: () => void updateUnlessUpToDate(workspacePath),
      },
      {
        id: 'workspace.refresh',
        group: 'Workspace',
        label: 'Refresh',
        icon: RefreshCw,
        shortcut: 'mod+r',
        run: () => void invalidateWorkspace(workspacePath),
      },
      {
        id: 'workspace.reviewMode',
        group: 'Workspace',
        label: 'Toggle review mode',
        icon: ListChecks,
        keywords: ['review', 'reviewed', 'mark'],
        run: () => void setReviewMode(workspacePath, !reviewing),
      },
      {
        id: 'workspace.open',
        group: 'Workspace',
        label: 'Open another workspace…',
        icon: FolderOpen,
        shortcut: 'mod+shift+o',
        run: closeWorkspace,
      },
      {
        id: 'app.commandLog',
        group: 'App',
        label: 'Toggle command log',
        icon: TerminalSquare,
        shortcut: 'mod+shift+l',
        run: () => useCommandLogStore.getState().toggle(),
      },
      {
        id: 'app.shortcuts',
        group: 'App',
        label: 'Keyboard shortcuts',
        icon: Keyboard,
        shortcut: 'mod+/',
        run: openShortcutsDialog,
      },
      ...THEMES.map(({ theme: choice, label, icon }) => ({
        id: `app.theme.${choice}`,
        group: 'App',
        label,
        icon,
        keywords: ['theme', 'appearance'],
        // The theme in use is not offered again.
        disabled: choice === theme,
        run: () => updateSettings({ theme: choice }),
      })),
    ],
    [workspacePath, closeWorkspace, theme, reviewing, updateSettings],
  );

  useCommands(commands);
}
