import { api } from '../../api/client';
import { openTaskWorkspaceDialog } from '../../features/taskWorkspace/TaskWorkspaceDialog';
import type { MenuEntry } from '../../lib/actions';
import { groupedMenu } from '../../lib/menuGroups';
import { copySubmenu } from '../../components/copyMenu';
import { menuAction } from '../../components/menuWords';
import { openTerminalIn } from '../workspace/workspaceShellActions';

/** The workspace card's menu: starting work next to the open workspace, and its folder. */
export function currentWorkspaceMenu(workspacePath: string, workspaceName?: string): MenuEntry[] {
  return groupedMenu([
    menuAction('newTaskWorkspace', () => openTaskWorkspaceDialog({ workspacePath })),
    menuAction('newWindow', () => void api.windows.openHome()),
    menuAction('reveal', () => void api.system.revealInFileManager(workspacePath)),
    menuAction('terminal', () => openTerminalIn(workspacePath)),
    copySubmenu('Workspace', { name: workspaceName, path: workspacePath }),
  ]);
}
