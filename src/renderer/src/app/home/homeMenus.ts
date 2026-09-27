import { Copy, FolderOpen, FolderPlus, FolderSearch, PenLine, SquareTerminal, Trash2, X } from 'lucide-react';
import type { RepositorySummary } from '@shared/domain/repository';
import type { WorkspaceSummary } from '@shared/domain/workspace';
import { SEPARATOR, type MenuEntry } from '../../lib/actions';
import { REVEAL_LABEL } from '../../lib/platform';
import { forgetRecentWorkspace } from '../settings/useSettings';
import { copyWorkspacePath, openTerminalIn } from '../workspace/workspaceShellActions';
import { copyRepositorySpec, deleteRepository, removeWorkspace, renameRepository, renameWorkspace, revealWorkspace } from './homeOperations';

export function workspaceMenu(workspace: WorkspaceSummary, open: (path: string) => void): MenuEntry[] {
  return [
    { id: 'open', label: 'Open', icon: FolderOpen, run: () => open(workspace.path) },
    { id: 'reveal', label: REVEAL_LABEL, icon: FolderSearch, run: () => revealWorkspace(workspace) },
    { id: 'terminal', label: 'Open terminal here', icon: SquareTerminal, run: () => openTerminalIn(workspace.path) },
    { id: 'copyPath', label: 'Copy path', icon: Copy, run: () => copyWorkspacePath(workspace.path) },
    SEPARATOR,
    { id: 'rename', label: 'Rename…', icon: PenLine, run: () => void renameWorkspace(workspace) },
    { id: 'remove', label: 'Remove workspace…', icon: X, danger: true, run: () => void removeWorkspace(workspace) },
  ];
}

export function missingWorkspaceMenu(workspace: WorkspaceSummary, open: (path: string) => void): MenuEntry[] {
  return [
    { id: 'open', label: 'Locate or recreate…', icon: FolderSearch, run: () => open(workspace.path) },
    SEPARATOR,
    { id: 'forget', label: 'Remove from list', icon: X, run: () => void forgetRecentWorkspace(workspace.path) },
  ];
}

export function repositoryMenu(repository: RepositorySummary, createWorkspace: (repository: RepositorySummary) => void): MenuEntry[] {
  return [
    { id: 'newWorkspace', label: 'New workspace…', icon: FolderPlus, run: () => createWorkspace(repository) },
    { id: 'copySpec', label: 'Copy repository spec', icon: Copy, run: () => copyRepositorySpec(repository) },
    SEPARATOR,
    { id: 'rename', label: 'Rename…', icon: PenLine, run: () => void renameRepository(repository) },
    { id: 'delete', label: 'Delete repository…', icon: Trash2, danger: true, run: () => void deleteRepository(repository) },
  ];
}
