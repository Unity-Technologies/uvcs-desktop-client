import { ArrowDownToLine, FolderOpen, Moon, RefreshCw, TerminalSquare } from 'lucide-react';
import { useMemo } from 'react';
import { useCommands, type Command } from '../commands/commandStore';
import { navigation } from '../navigation/navigationStore';
import { VIEWS } from '../navigation/viewRegistry';
import { invalidateWorkspace } from '../queryClient';
import { useSettings, useUpdateSettings } from '../settings/useSettings';
import { useSession } from '../workspace/sessionStore';
import { useWorkspacePath } from '../workspace/useWorkspace';
import { useCommandLogStore } from './commandLogStore';
import { updateWorkspace } from './workspaceOperations';

/** Commands available everywhere inside a workspace. */
export function useWorkspaceCommands(): void {
  const workspacePath = useWorkspacePath();
  const closeWorkspace = useSession((state) => state.closeWorkspace);
  const { theme } = useSettings();
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
        run: () => void updateWorkspace(workspacePath),
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
        id: 'app.theme',
        group: 'App',
        label: theme === 'dark' ? 'Use light theme' : 'Use dark theme',
        icon: Moon,
        run: () => updateSettings({ theme: theme === 'dark' ? 'light' : 'dark' }),
      },
    ],
    [workspacePath, closeWorkspace, theme, updateSettings],
  );

  useCommands(commands);
}
