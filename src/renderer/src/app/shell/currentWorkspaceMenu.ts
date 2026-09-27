import { AppWindow, Copy, FolderGit2, FolderSearch, SquareTerminal } from 'lucide-react';
import { api } from '../../api/client';
import { openTaskWorkspaceDialog } from '../../features/taskWorkspace/TaskWorkspaceDialog';
import type { MenuEntry } from '../../lib/actions';
import { groupedMenu } from '../../lib/menuGroups';
import { REVEAL_LABEL } from '../../lib/platform';
import { copyWorkspacePath, openTerminalIn } from '../workspace/workspaceShellActions';

/** The workspace card's menu: starting work next to the open workspace, and its folder. */
export function currentWorkspaceMenu(workspacePath: string): MenuEntry[] {
  return groupedMenu({
    create: [
      { id: 'taskWorkspace', label: 'New workspace for a task…', icon: FolderGit2, run: () => openTaskWorkspaceDialog({ workspacePath }) },
      { id: 'newWindow', label: 'New window', icon: AppWindow, run: () => void api.windows.openHome() },
    ],
    external: [
      { id: 'reveal', label: REVEAL_LABEL, icon: FolderSearch, run: () => void api.system.revealInFileManager(workspacePath) },
      { id: 'terminal', label: 'Open terminal here', icon: SquareTerminal, run: () => openTerminalIn(workspacePath) },
    ],
    copy: [{ id: 'copyPath', label: 'Copy workspace path', icon: Copy, run: () => copyWorkspacePath(workspacePath) }],
  });
}
