import type { RepositorySummary } from '@shared/domain/repository';
import type { WorkspaceSummary } from '@shared/domain/workspace';
import type { MenuEntry } from '../../lib/actions';
import { groupedMenu } from '../../lib/menuGroups';
import { copySubmenu } from '../../components/copyMenu';
import { menuAction } from '../../components/menuWords';
import { openRepositoryPathPermissions, openRepositoryPermissions, openServerPermissions } from '../../features/permissions/openPermissions';
import { forgetRecentWorkspace } from '../settings/useSettings';
import { openTerminalIn, revealWorkspace } from '../workspace/workspaceShellActions';
import { deleteRepository, removeWorkspace, renameRepository, renameWorkspace } from './homeOperations';

export function workspaceMenu(workspace: WorkspaceSummary, open: (path: string) => void): MenuEntry[] {
  return groupedMenu([
    menuAction('openWorkspace', () => open(workspace.path)),
    menuAction('reveal', () => revealWorkspace(workspace.path)),
    menuAction('terminal', () => openTerminalIn(workspace.path)),
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
    copySubmenu('Repository', { name: repository.name, spec: repository.spec }),
    menuAction('rename', () => void renameRepository(repository)),
    menuAction('permissions', () => openRepositoryPermissions(repository.spec, { owner: repository.owner })),
    menuAction('pathPermissions', () => openRepositoryPathPermissions(repository.spec)),
    menuAction('serverPermissions', () => openServerPermissions(repository.server)),
    menuAction('delete', () => void deleteRepository(repository), { label: 'Delete repository…' }),
  ]);
}
