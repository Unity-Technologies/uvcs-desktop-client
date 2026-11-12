import type { WorkspaceKind, WorkspaceSelector } from '@shared/domain/workspace';
import { api } from '../../api/client';
import { openChooseDownloads } from '../../features/partialWorkspace/ChooseDownloadsDialog';
import { choosesDownloads } from '../../features/partialWorkspace/workspaceDownloads';
import { openTaskWorkspaceDialog } from '../../features/taskWorkspace/TaskWorkspaceDialog';
import type { MenuEntry } from '../../lib/actions';
import { groupedMenu } from '../../lib/menuGroups';
import { copySubmenu } from '../../components/copyMenu';
import { openOnDiskEntries } from '../../components/externalApps/openWithMenu';
import { menuAction } from '../../components/menuWords';

/** What the card knows of the open workspace; all arrive with its info, after the menu can first open. */
export interface CurrentWorkspace {
  name?: string;
  kind?: WorkspaceKind;
  selector?: WorkspaceSelector;
}

/**
 * The workspace card's menu: choosing what the workspace downloads (`choosesDownloads`: a standard one on a branch
 * becomes partial), starting work next to the open workspace, and opening its folder in other apps.
 */
export function currentWorkspaceMenu(workspacePath: string, { name, kind, selector }: CurrentWorkspace = {}): MenuEntry[] {
  return groupedMenu([
    choosesDownloads(kind, selector) && menuAction('chooseDownloads', () => openChooseDownloads(workspacePath)),
    menuAction('newTaskWorkspace', () => openTaskWorkspaceDialog({ workspacePath })),
    menuAction('newWindow', () => void api.windows.openHome()),
    ...openOnDiskEntries({ path: workspacePath, isFolder: true, isWorkspace: true }),
    copySubmenu('Workspace', { name, path: workspacePath }),
  ]);
}
