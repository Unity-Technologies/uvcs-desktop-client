import type { ConnectionProblem } from '@shared/domain/setup';

/**
 * The connection problem the card shows (`ConnectionProblemCard`): the open workspace's server's, until dismissed for
 * that server. The home screen has no workspace, so it shows none: it asks no server, and works without one.
 */
export function connectionProblemShown(
  problem: ConnectionProblem | null | undefined,
  { workspaceOpen, dismissedServer }: { workspaceOpen: boolean; dismissedServer: string | null },
): ConnectionProblem | null {
  if (!problem || !workspaceOpen || problem.server === dismissedServer) return null;
  return problem;
}
