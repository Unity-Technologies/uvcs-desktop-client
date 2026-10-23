import type { ConnectionProblem, SetupProblem } from '@shared/domain/setup';

/**
 * The connection problem the card shows (`ConnectionProblemCard`): the open workspace's server's, until dismissed for
 * that server. The home screen has no workspace, so it shows none: it asks no server, and works without one.
 */
export function connectionProblemShown(
  problem: ConnectionProblem | null | undefined,
  { placeOpen, dismissedServer }: { placeOpen: boolean; dismissedServer: string | null },
): ConnectionProblem | null {
  if (!problem || !placeOpen || problem.server === dismissedServer) return null;
  return problem;
}

/**
 * The server to check (`useConnectionCheck`): the window's place's (`serverOfPlace`: a workspace's, a repository
 * explored without one), once the setup check passed, as a `cm` without configuration reaches no server. None while
 * either is unknown, and none on the home screen.
 */
export function serverToCheck(setupProblem: SetupProblem | null | undefined, placeServer: string | undefined): string | undefined {
  return setupProblem === null ? placeServer : undefined;
}
