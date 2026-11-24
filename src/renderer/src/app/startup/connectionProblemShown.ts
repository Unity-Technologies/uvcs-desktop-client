import type { ConnectionProblem, SetupProblem } from '@shared/domain/setup';

/**
 * The server out of reach the card shows (`ConnectionProblemCard`): the window's place's (a workspace's, or a
 * repository's explored without one: `serverOfPlace`), until dismissed for that server. The home screen shows none: it
 * asks no server, and works without one. A server that needs a sign-in shows the sign-in screen instead (`SignInScreen`).
 */
export function connectionProblemShown(
  problem: ConnectionProblem | null | undefined,
  { placeOpen, dismissedServer }: { placeOpen: boolean; dismissedServer: string | null },
): ConnectionProblem | null {
  if (!problem || !placeOpen || problem.server === dismissedServer) return null;
  return problem;
}

/**
 * The server to check (`useWindowSessionCheck`): the window's place's (`serverOfPlace`: a workspace's, a repository
 * explored without one), once the setup check passed, as a `cm` without configuration reaches no server. None while
 * either is unknown, and none on the home screen.
 */
export function serverToCheck(setupProblem: SetupProblem | null | undefined, placeServer: string | undefined): string | undefined {
  return setupProblem === null ? placeServer : undefined;
}
