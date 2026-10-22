import type { RepositorySummary } from '@shared/domain/repository';
import type { WorkspaceSummary } from '@shared/domain/workspace';
import type { MenuEntry } from '../../lib/actions';
import { groupedMenu } from '../../lib/menuGroups';
import { hotkey } from '../../lib/shortcutRegistry';
import { copySubmenu } from '../../components/copyMenu';
import { openOnDiskEntries } from '../../components/externalApps/openWithMenu';
import { menuAction } from '../../components/menuWords';
import { openRepositoryPathPermissions, openRepositoryPermissions, openServerPermissions } from '../../features/permissions/openPermissions';
import { repositoryLinkTo } from '../links/linkTo';
import { forgetRecentWorkspace } from '../settings/useSettings';
import type { OpenWorkspaceIn } from '../workspace/workspaceWindowChoice';
import { deleteRepository, removeWorkspace, renameRepository, renameWorkspace } from './homeOperations';

/** A workspace's menu wherever it's listed (the home screen, the switcher, the palette); `open` opens it here or in a new window. */
export function workspaceMenu(workspace: WorkspaceSummary, open: OpenWorkspaceIn): MenuEntry[] {
  return groupedMenu([
    menuAction('openWorkspace', () => open(workspace.path, 'here')),
    menuAction('openInNewWindow', () => open(workspace.path, 'newWindow'), { shortcut: hotkey('workspaceInNewWindow') }),
    ...openOnDiskEntries({ path: workspace.path, isFolder: true, isWorkspace: true }),
    copySubmenu('Workspace', { name: workspace.name, path: workspace.path }),
    menuAction('rename', () => void renameWorkspace(workspace)),
    menuAction('remove', () => void removeWorkspace(workspace), { label: 'Remove workspace…' }),
  ]);
}

export function missingWorkspaceMenu(workspace: WorkspaceSummary, open: (path: string) => void): MenuEntry[] {
  return groupedMenu([menuAction('locate', () => open(workspace.path)), menuAction('forget', () => void forgetRecentWorkspace(workspace.path))]);
}

export function repositoryMenu(repository: RepositorySummary, createWorkspace: (repository: RepositorySummary) => void): MenuEntry[] {
  return groupedMenu([
    menuAction('newWorkspace', () => createWorkspace(repository)),
    copySubmenu('Repository', { name: repository.name, link: repositoryLinkTo(repository.spec, {}), spec: repository.spec }),
    menuAction('rename', () => void renameRepository(repository)),
    menuAction('permissions', () => openRepositoryPermissions(repository.spec, { owner: repository.owner })),
    menuAction('pathPermissions', () => openRepositoryPathPermissions(repository.spec)),
    menuAction('serverPermissions', () => openServerPermissions(repository.server)),
    menuAction('delete', () => void deleteRepository(repository), { label: 'Delete repository…' }),
  ]);
}
