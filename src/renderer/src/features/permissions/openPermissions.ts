import { workspacePlace, type Place } from '@shared/domain/place';
import { serverOfRepository } from '@shared/domain/permissions';
import type { WorkspaceInfo } from '@shared/domain/workspace';
import { queryKeys } from '../../api/queryKeys';
import { queryClient } from '../../app/queryClient';
import { toast } from '../../ui/toast/toastStore';
import { openPermissionsDialog } from './PermissionsDialog';
import { pathTarget, repositoryObjectTarget, repositoryTarget, serverTarget } from './permissionTargets';

/**
 * The repository of the place: a repository's own, or a workspace's as its info (on screen wherever these menus show)
 * names it. An object listed without its repository is the place's.
 */
function placeRepository(place: Place): string | undefined {
  if (place.kind === 'repository') return place.repository;
  return queryClient.getQueryData<WorkspaceInfo>(queryKeys.inWorkspace(place.workspacePath, 'info'))?.repository;
}

function inRepository(place: Place, repository: string | undefined, open: (repository: string) => void): void {
  const known = repository || placeRepository(place);
  if (known) open(known);
  else toast.error("Couldn't open the permissions", 'The workspace’s repository isn’t known yet.');
}

/** The permissions of a branch, a label or an attribute of the place's repository (or of `object.repository`). */
export function openObjectPermissions(
  place: Place,
  kind: 'branch' | 'label' | 'attribute',
  object: { name: string; repository?: string; owner?: string },
): void {
  inRepository(place, object.repository, (repository) =>
    openPermissionsDialog({ target: repositoryObjectTarget(kind, object.name, repository, object.owner), place }),
  );
}

/**
 * Why a workspace item's path permissions can't be opened, if they can't: an item under an xlink lives in the xlinked
 * repository, at a path the workspace's doesn't tell.
 */
export function itemPathPermissionsUnavailable(workspacePath: string, itemRepository: string): string | undefined {
  const repository = placeRepository(workspacePlace(workspacePath));
  return repository && itemRepository && itemRepository !== repository ? 'Inside an xlink: its permissions are set in the xlinked repository' : undefined;
}

/** The permissions of a workspace item's path (`src/a.ts`), on every branch. */
export function openItemPathPermissions(workspacePath: string, path: string): void {
  const place = workspacePlace(workspacePath);
  inRepository(place, undefined, (repository) => openPermissionsDialog({ target: pathTarget(repository, path), place }));
}

/** The permissions of a repository (`name@server`), from the home screen or a place on it. */
export function openRepositoryPermissions(repository: string, { owner, place }: { owner?: string; place?: Place } = {}): void {
  openPermissionsDialog({ target: repositoryTarget(repository, owner), place });
}

/** The permissions of a repository's paths, starting at its root. */
export function openRepositoryPathPermissions(repository: string, place?: Place): void {
  openPermissionsDialog({ target: pathTarget(repository, '/'), place });
}

export function openServerPermissions(server: string, place?: Place): void {
  openPermissionsDialog({ target: serverTarget(server), place });
}

/** The permissions of the place's own repository or server. */
export function openOwnRepositoryPermissions(place: Place, of: 'repository' | 'server' | 'paths'): void {
  inRepository(place, undefined, (repository) => {
    if (of === 'repository') openRepositoryPermissions(repository, { place });
    else if (of === 'paths') openRepositoryPathPermissions(repository, place);
    else openServerPermissions(serverOfRepository(repository), place);
  });
}
