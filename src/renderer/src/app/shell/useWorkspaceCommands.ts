import { ArrowDownToLine, CodeXml, Copy, FolderGit2, FolderOpen, FolderSearch, ListChecks, Monitor, Moon, Pause, Play, RefreshCw, SquareTerminal, Sun, TerminalSquare } from 'lucide-react';
import type { ThemePreference } from '@shared/domain/settings';
import { defaultEditor, defaultTerminal, useExternalApps } from '../../components/externalApps/externalApps';
import { openInEditor } from '../../components/externalApps/externalAppOperations';
import { setReviewMode } from '../../features/review/reviewModeSetting';
import { openTaskWorkspaceDialog } from '../../features/taskWorkspace/TaskWorkspaceDialog';
import type { Icon } from '../../lib/actions';
import { useMemo } from 'react';
import { useCommands, type Command } from '../commands/commandStore';
import { navigation } from '../navigation/navigationStore';
import { VIEWS } from '../navigation/viewRegistry';
import { invalidateWorkspace } from '../queryClient';
import { useSettings, useUpdateSettings } from '../settings/useSettings';
import { useSession } from '../workspace/sessionStore';
import { useWorkspacePath } from '../workspace/useWorkspace';
import { copyWorkspacePath, openTerminalIn, revealWorkspace } from '../workspace/workspaceShellActions';
import { REVEAL_LABEL } from '../../lib/platform';
import { useCommandLogStore } from './commandLogStore';
import { updateUnlessUpToDate } from './workspaceOperations';
import { hotkey } from '../../lib/shortcutRegistry';

const THEMES: { theme: ThemePreference; label: string; icon: Icon }[] = [
  { theme: 'system', label: 'Use system theme', icon: Monitor },
  { theme: 'light', label: 'Use light theme', icon: Sun },
  { theme: 'dark', label: 'Use dark theme', icon: Moon },
];

/** Commands available everywhere inside a workspace. */
export function useWorkspaceCommands(): void {
  const workspacePath = useWorkspacePath();
  const closeWorkspace = useSession((state) => state.closeWorkspace);
  const { theme, reviewModeWorkspaces, autoRefresh } = useSettings();
  const reviewing = reviewModeWorkspaces.includes(workspacePath);
  const updateSettings = useUpdateSettings();
  const commandLogOpen = useCommandLogStore((state) => state.open);
  const apps = useExternalApps();
  const editor = defaultEditor(apps);
  const terminal = defaultTerminal(apps);

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
        shortcut: hotkey('updateWorkspace'),
        run: () => void updateUnlessUpToDate(workspacePath),
      },
      {
        id: 'workspace.refresh',
        group: 'Workspace',
        label: 'Refresh',
        icon: RefreshCw,
        shortcut: hotkey('refresh'),
        run: () => void invalidateWorkspace(workspacePath),
      },
      {
        id: 'workspace.autoRefresh',
        group: 'Workspace',
        label: autoRefresh ? 'Pause automatic refresh' : 'Resume automatic refresh',
        icon: autoRefresh ? Pause : Play,
        keywords: ['refresh', 'watch', 'live'],
        run: () => updateSettings({ autoRefresh: !autoRefresh }),
      },
      {
        id: 'workspace.reviewMode',
        group: 'Workspace',
        label: reviewing ? 'Leave review mode' : 'Enter review mode',
        icon: ListChecks,
        keywords: ['review', 'reviewed', 'mark'],
        run: () => void setReviewMode(workspacePath, !reviewing),
      },
      {
        id: 'workspace.open',
        group: 'Workspace',
        label: 'Open another workspace…',
        icon: FolderOpen,
        shortcut: hotkey('openWorkspace'),
        run: closeWorkspace,
      },
      {
        id: 'workspace.newForTask',
        group: 'Workspace',
        label: 'New workspace for a task…',
        icon: FolderGit2,
        keywords: ['agent', 'branch', 'parallel', 'worktree'],
        run: () => openTaskWorkspaceDialog({ workspacePath }),
      },
      ...(editor?.opensFolders
        ? [
            {
              id: 'workspace.openInEditor',
              group: 'Workspace',
              label: `Open workspace in ${editor.name}`,
              icon: CodeXml,
              keywords: ['editor', 'ide', 'code'],
              run: () => void openInEditor(workspacePath),
            },
          ]
        : []),
      {
        id: 'workspace.openTerminal',
        group: 'Workspace',
        label: terminal ? `Open workspace in ${terminal.name}` : 'Open terminal here',
        icon: SquareTerminal,
        keywords: ['terminal', 'shell', 'console', 'agent'],
        run: () => openTerminalIn(workspacePath),
      },
      {
        id: 'workspace.reveal',
        group: 'Workspace',
        label: REVEAL_LABEL,
        icon: FolderSearch,
        keywords: ['folder', 'directory', 'file manager'],
        run: () => revealWorkspace(workspacePath),
      },
      {
        id: 'workspace.copyPath',
        group: 'Workspace',
        label: 'Copy workspace path',
        icon: Copy,
        keywords: ['folder', 'directory'],
        run: () => copyWorkspacePath(workspacePath),
      },
      {
        id: 'app.commandLog',
        group: 'App',
        label: commandLogOpen ? 'Hide command log' : 'Show command log',
        icon: TerminalSquare,
        shortcut: hotkey('commandLog'),
        run: () => useCommandLogStore.getState().toggle(),
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
    [workspacePath, closeWorkspace, theme, reviewing, autoRefresh, commandLogOpen, updateSettings, editor, terminal],
  );

  useCommands(commands);
}
