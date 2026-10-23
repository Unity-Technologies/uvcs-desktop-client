import { serverOfRepository } from '@shared/domain/permissions';
import type { Place } from '@shared/domain/place';
import type { WorkspaceInfo } from '@shared/domain/workspace';

/** What a workspace's info says of where it is from: undefined while it's read, and for a repository's place. */
type WorkspaceOrigin = Pick<WorkspaceInfo, 'repository' | 'server'> | undefined;

/** The repository a place reads: a repository's own at once; a workspace's once its info is read, undefined until then. */
export function repositoryOfPlace(place: Place, workspace: WorkspaceOrigin): string | undefined {
  return place.kind === 'repository' ? place.repository : workspace?.repository;
}

/**
 * The server of a place's repository: a repository's own, from its spec, at once; a workspace's once its info is read.
 * None for a spec that names no server, so nothing asks `cm` about a server named ''.
 */
export function serverOfPlace(place: Place, workspace: WorkspaceOrigin): string | undefined {
  return place.kind === 'repository' ? serverOfRepository(place.repository) || undefined : workspace?.server;
}
