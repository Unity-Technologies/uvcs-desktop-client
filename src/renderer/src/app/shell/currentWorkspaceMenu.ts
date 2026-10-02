import { api } from '../../api/client';
import { openTaskWorkspaceDialog } from '../../features/taskWorkspace/TaskWorkspaceDialog';
import type { MenuEntry } from '../../lib/actions';
import { groupedMenu } from '../../lib/menuGroups';
import { copySubmenu } from '../../components/copyMenu';
import { openOnDiskEntries } from '../../components/externalApps/openWithMenu';
import { menuAction } from '../../components/menuWords';

/** The workspace card's menu: starting work next to the open workspace, and opening its folder in other apps. */
export function currentWorkspaceMenu(workspacePath: string, workspaceName?: string): MenuEntry[] {
  return groupedMenu([
    menuAction('newTaskWorkspace', () => openTaskWorkspaceDialog({ workspacePath })),
    menuAction('newWindow', () => void api.windows.openHome()),
    ...openOnDiskEntries({ path: workspacePath, isFolder: true }),
    copySubmenu('Workspace', { name: workspaceName, path: workspacePath }),
  ]);
}
