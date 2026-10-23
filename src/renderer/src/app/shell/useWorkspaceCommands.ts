import { ArrowDownToLine, CodeXml, Copy, FolderGit2, FolderSearch, Pause, Play, SquareTerminal } from 'lucide-react';
import { useMemo } from 'react';
import { defaultEditor, defaultTerminal, useExternalApps } from '../../components/externalApps/externalApps';
import { openInEditor } from '../../components/externalApps/externalAppOperations';
import { openTaskWorkspaceDialog } from '../../features/taskWorkspace/TaskWorkspaceDialog';
import { OPEN_IN_FILE_MANAGER_LABEL } from '../../lib/platform';
import { hotkey } from '../../lib/shortcutRegistry';
import { useCommands, type Command } from '../commands/commandStore';
import { useSettings, useUpdateSettings } from '../settings/useSettings';
import { useWorkspacePath } from '../workspace/useWorkspace';
import { copyWorkspacePath, openTerminalIn, openWorkspaceInFileManager } from '../workspace/workspaceShellActions';
import { updateUnlessUpToDate } from './workspaceOperations';

/** Commands only a workspace has, beside every place's (`usePlaceCommands`): its files on disk and updating them. */
export function useWorkspaceCommands(): void {
  const workspacePath = useWorkspacePath();
  const { autoRefresh } = useSettings();
  const updateSettings = useUpdateSettings();
  const apps = useExternalApps();
  const editor = defaultEditor(apps);
  const terminal = defaultTerminal(apps);

  const commands = useMemo<Command[]>(
    () => [
      {
        id: 'workspace.update',
        group: 'Workspace',
        label: 'Update workspace',
        icon: ArrowDownToLine,
        shortcut: hotkey('updateWorkspace'),
        run: () => void updateUnlessUpToDate(workspacePath),
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
        id: 'workspace.openInFileManager',
        group: 'Workspace',
        label: OPEN_IN_FILE_MANAGER_LABEL,
        icon: FolderSearch,
        keywords: ['folder', 'directory', 'file manager', 'reveal', 'show'],
        run: () => openWorkspaceInFileManager(workspacePath),
      },
      {
        id: 'workspace.copyPath',
        group: 'Workspace',
        label: 'Copy workspace path',
        icon: Copy,
        keywords: ['folder', 'directory'],
        run: () => copyWorkspacePath(workspacePath),
      },
    ],
    [workspacePath, autoRefresh, updateSettings, editor, terminal],
  );

  useCommands(commands);
}
