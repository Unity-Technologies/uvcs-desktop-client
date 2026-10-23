import type { Place } from '@shared/domain/place';
import type { WorkspaceInfo } from '@shared/domain/workspace';
import { describeServer, splitRepositorySpec } from '../../lib/servers';

export const APP_TITLE = 'Unity Version Control';

/** A repository explored without a workspace, as its window is titled: "<repository> — <server>", the server as the home screen names it. */
export function repositoryWindowTitle(repository: string): string {
  const { name, server } = splitRepositorySpec(repository);
  return `${name} — ${describeServer(server).label}`;
}

/** The name a place goes by in a title: a workspace's name once its info is read, a repository's own name. */
export function placeName(place: Place, workspace: Pick<WorkspaceInfo, 'name'> | undefined): string | undefined {
  return place.kind === 'repository' ? splitRepositorySpec(place.repository).name : workspace?.name;
}
