import type { WorkspaceKind } from '@shared/domain/workspace';
import { api } from '../../api/client';
import { openChooseDownloads } from '../../features/partialWorkspace/ChooseDownloadsDialog';
import { openTaskWorkspaceDialog } from '../../features/taskWorkspace/TaskWorkspaceDialog';
import type { MenuEntry } from '../../lib/actions';
import { groupedMenu } from '../../lib/menuGroups';
import { copySubmenu } from '../../components/copyMenu';
import { openOnDiskEntries } from '../../components/externalApps/openWithMenu';
import { menuAction } from '../../components/menuWords';

/** What the card knows of the open workspace; both arrive with its info, after the menu can first open. */
export interface CurrentWorkspace {
  name?: string;
  kind?: WorkspaceKind;
}

/**
 * The workspace card's menu: choosing what a partial workspace downloads (only a partial one: any other holds every
 * file), starting work next to the open workspace, and opening its folder in other apps.
 */
export function currentWorkspaceMenu(workspacePath: string, { name, kind }: CurrentWorkspace = {}): MenuEntry[] {
  return groupedMenu([
    kind === 'partial' && menuAction('chooseDownloads', () => openChooseDownloads(workspacePath)),
    menuAction('newTaskWorkspace', () => openTaskWorkspaceDialog({ workspacePath })),
    menuAction('newWindow', () => void api.windows.openHome()),
    ...openOnDiskEntries({ path: workspacePath, isFolder: true, isWorkspace: true }),
    copySubmenu('Workspace', { name, path: workspacePath }),
  ]);
}
