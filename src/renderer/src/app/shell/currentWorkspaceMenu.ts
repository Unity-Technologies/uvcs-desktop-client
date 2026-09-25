import { AppWindow, Copy, FolderGit2, FolderSearch, SquareTerminal } from 'lucide-react';
import { api } from '../../api/client';
import { openTaskWorkspaceDialog } from '../../features/taskWorkspace/TaskWorkspaceDialog';
import { SEPARATOR, type MenuEntry } from '../../lib/actions';
import { copyWorkspacePath, openTerminalIn } from '../workspace/workspaceShellActions';

/** The workspace card's menu: the open workspace's folder, and starting work next to it. */
export function currentWorkspaceMenu(workspacePath: string): MenuEntry[] {
  return [
    { id: 'terminal', label: 'Open terminal here', icon: SquareTerminal, run: () => openTerminalIn(workspacePath) },
    { id: 'copyPath', label: 'Copy workspace path', icon: Copy, run: () => copyWorkspacePath(workspacePath) },
    { id: 'reveal', label: 'Reveal in file manager', icon: FolderSearch, run: () => void api.system.revealInFileManager(workspacePath) },
    SEPARATOR,
    { id: 'taskWorkspace', label: 'New workspace for a task…', icon: FolderGit2, run: () => openTaskWorkspaceDialog({ workspacePath }) },
    { id: 'newWindow', label: 'New window', icon: AppWindow, run: () => void api.windows.openHome() },
  ];
}
