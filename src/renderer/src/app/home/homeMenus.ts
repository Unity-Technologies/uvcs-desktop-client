import { Copy, FolderOpen, FolderPlus, FolderSearch, Pencil, SquareTerminal, Trash2, X } from 'lucide-react';
import type { RepositorySummary } from '@shared/domain/repository';
import type { WorkspaceSummary } from '@shared/domain/workspace';
import type { MenuEntry } from '../../lib/actions';
import { groupedMenu } from '../../lib/menuGroups';
import { REVEAL_LABEL } from '../../lib/platform';
import { forgetRecentWorkspace } from '../settings/useSettings';
import { copyWorkspacePath, openTerminalIn } from '../workspace/workspaceShellActions';
import { copyRepositorySpec, deleteRepository, removeWorkspace, renameRepository, renameWorkspace, revealWorkspace } from './homeOperations';

export function workspaceMenu(workspace: WorkspaceSummary, open: (path: string) => void): MenuEntry[] {
  return groupedMenu({
    primary: [{ id: 'open', label: 'Open', icon: FolderOpen, run: () => open(workspace.path) }],
    external: [
      { id: 'reveal', label: REVEAL_LABEL, icon: FolderSearch, run: () => revealWorkspace(workspace) },
      { id: 'terminal', label: 'Open terminal here', icon: SquareTerminal, run: () => openTerminalIn(workspace.path) },
    ],
    copy: [{ id: 'copyPath', label: 'Copy path', icon: Copy, run: () => copyWorkspacePath(workspace.path) }],
    edit: [{ id: 'rename', label: 'Rename…', icon: Pencil, run: () => void renameWorkspace(workspace) }],
    danger: [{ id: 'remove', label: 'Remove workspace…', icon: X, danger: true, run: () => void removeWorkspace(workspace) }],
  });
}

export function missingWorkspaceMenu(workspace: WorkspaceSummary, open: (path: string) => void): MenuEntry[] {
  return groupedMenu({
    primary: [{ id: 'open', label: 'Locate or recreate…', icon: FolderSearch, run: () => open(workspace.path) }],
    edit: [{ id: 'forget', label: 'Remove from list', icon: X, run: () => void forgetRecentWorkspace(workspace.path) }],
  });
}

export function repositoryMenu(repository: RepositorySummary, createWorkspace: (repository: RepositorySummary) => void): MenuEntry[] {
  return groupedMenu({
    create: [{ id: 'newWorkspace', label: 'New workspace…', icon: FolderPlus, run: () => createWorkspace(repository) }],
    copy: [{ id: 'copySpec', label: 'Copy repository spec', icon: Copy, run: () => copyRepositorySpec(repository) }],
    edit: [{ id: 'rename', label: 'Rename…', icon: Pencil, run: () => void renameRepository(repository) }],
    danger: [{ id: 'delete', label: 'Delete repository…', icon: Trash2, danger: true, run: () => void deleteRepository(repository) }],
  });
}
