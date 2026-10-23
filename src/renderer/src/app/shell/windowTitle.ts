import { describeServer, splitRepositorySpec } from '../../lib/servers';

export const APP_TITLE = 'Unity Version Control';

/** A repository explored without a workspace, as its window is titled: "<repository> — <server>", the server as the home screen names it. */
export function repositoryWindowTitle(repository: string): string {
  const { name, server } = splitRepositorySpec(repository);
  return `${name} — ${describeServer(server).label}`;
}
