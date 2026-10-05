import { serverOfRepository } from '@shared/domain/permissions';
import type { WorkspaceInfo } from '@shared/domain/workspace';
import { queryKeys } from '../../api/queryKeys';
import { queryClient } from '../../app/queryClient';
import { toast } from '../../ui/toast/toastStore';
import { openPermissionsDialog } from './PermissionsDialog';
import { pathTarget, repositoryObjectTarget, repositoryTarget, serverTarget } from './permissionTargets';

/**
 * The repository of the workspace, as its info (on screen wherever these menus show) names it. An object listed
 * without its repository is the workspace's.
 */
function workspaceRepository(workspacePath: string): string | undefined {
  return queryClient.getQueryData<WorkspaceInfo>(queryKeys.inWorkspace(workspacePath, 'info'))?.repository;
}

function inRepository(workspacePath: string, repository: string | undefined, open: (repository: string) => void): void {
  const known = repository || workspaceRepository(workspacePath);
  if (known) open(known);
  else toast.error("Couldn't open the permissions", 'The workspace’s repository isn’t known yet.');
}

/** The permissions of a branch, a label or an attribute of the workspace's repository (or of `object.repository`). */
export function openObjectPermissions(
  workspacePath: string,
  kind: 'branch' | 'label' | 'attribute',
  object: { name: string; repository?: string; owner?: string },
): void {
  inRepository(workspacePath, object.repository, (repository) =>
    openPermissionsDialog({ target: repositoryObjectTarget(kind, object.name, repository, object.owner), workspacePath }),
  );
}

/**
 * Why a workspace item's path permissions can't be opened, if they can't: an item under an xlink lives in the xlinked
 * repository, at a path the workspace's doesn't tell.
 */
export function itemPathPermissionsUnavailable(workspacePath: string, itemRepository: string): string | undefined {
  const repository = workspaceRepository(workspacePath);
  return repository && itemRepository && itemRepository !== repository ? 'Inside an xlink: its permissions are set in the xlinked repository' : undefined;
}

/** The permissions of a workspace item's path (`src/a.ts`), on every branch. */
export function openItemPathPermissions(workspacePath: string, path: string): void {
  inRepository(workspacePath, undefined, (repository) => openPermissionsDialog({ target: pathTarget(repository, path), workspacePath }));
}

/** The permissions of a repository (`name@server`), from the home screen or its workspace. */
export function openRepositoryPermissions(repository: string, { owner, workspacePath }: { owner?: string; workspacePath?: string } = {}): void {
  openPermissionsDialog({ target: repositoryTarget(repository, owner), workspacePath });
}

/** The permissions of a repository's paths, starting at its root. */
export function openRepositoryPathPermissions(repository: string, workspacePath?: string): void {
  openPermissionsDialog({ target: pathTarget(repository, '/'), workspacePath });
}

export function openServerPermissions(server: string, workspacePath?: string): void {
  openPermissionsDialog({ target: serverTarget(server), workspacePath });
}

/** The permissions of the workspace's own repository or server. */
export function openWorkspaceRepositoryPermissions(workspacePath: string, of: 'repository' | 'server' | 'paths'): void {
  inRepository(workspacePath, undefined, (repository) => {
    if (of === 'repository') openRepositoryPermissions(repository, { workspacePath });
    else if (of === 'paths') openRepositoryPathPermissions(repository, workspacePath);
    else openServerPermissions(serverOfRepository(repository), workspacePath);
  });
}
