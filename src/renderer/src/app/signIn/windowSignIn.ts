import type { Query } from '@tanstack/react-query';
import type { Place } from '@shared/domain/place';
import type { ServerSession, SignInProblem } from '@shared/domain/signIn';
import type { WorkspaceInfo } from '@shared/domain/workspace';
import { ApiError } from '../../api/client';
import { serverOfPlace } from '../workspace/placeOrigin';

/** What a workspace's info query holds: its info once read, and its last failure. */
interface WorkspaceInfoRead {
  data: WorkspaceInfo | undefined;
  error: unknown;
}

/**
 * The sign-in problem that covers the window with the sign-in screen (`SignInScreen`): its place's server's, while
 * main says that server needs a sign-in. None on the home screen, or while the place's server isn't known.
 */
export function signInCovering(sessions: readonly ServerSession[] | undefined, placeServer: string | undefined): SignInProblem | null {
  if (placeServer === undefined) return null;
  const session = sessions?.find((candidate) => candidate.server === placeServer);
  return session?.state === 'needsSignIn' ? session.problem : null;
}

/** The sign-in problem an API call failed for (its command refused, or run into it), or null for any other failure. */
export function signInProblemOf(error: unknown): SignInProblem | null {
  return error instanceof ApiError ? (error.signIn ?? null) : null;
}

/**
 * Whether a failure is one the window's sign-in screen tells: a sign-in its place's server needs, which main confirmed
 * before failing it, so the screen covers the window. Such a failure raises no toast of its own.
 */
export function toldBySignInScreen(error: unknown, placeServer: string | undefined): boolean {
  return placeServer !== undefined && signInProblemOf(error)?.server === placeServer;
}

/** The servers that needed a sign-in before and don't anymore: signed in again. */
export function signedInAgain(before: readonly ServerSession[], after: readonly ServerSession[]): string[] {
  const stillNeeding = new Set(after.filter((session) => session.state === 'needsSignIn').map((session) => session.server));
  return before.filter((session) => session.state === 'needsSignIn' && !stillNeeding.has(session.server)).map((session) => session.server);
}

/** The queries to read again once `server` signed in: the ones whose last read failed for its sign-in. */
export function failedForSignInTo(server: string): (query: Query) => boolean {
  return (query) => query.state.status === 'error' && signInProblemOf(query.state.error)?.server === server;
}

/**
 * The command-log entries of the queries that failed for `server`'s sign-in: told by the sign-in screen, and no failure
 * to point at once signed in (`isUnseenFailure`).
 */
export function failedForSignInEntries(queries: readonly Query[], server: string): number[] {
  const failed = failedForSignInTo(server);
  return queries.filter(failed).flatMap((query) => {
    const error = query.state.error;
    return error instanceof ApiError && error.command ? [error.command.logEntryId] : [];
  });
}

/**
 * The sign-in a workspace's info couldn't be read for (its header asks the server for its branch's head), while it was
 * never read: the window shows the sign-in screen as its page (`WorkspaceGate`). None once read: a later failure keeps
 * the workspace's screen, covered.
 */
export function workspaceSignInProblem(info: WorkspaceInfoRead): SignInProblem | null {
  return info.data ? null : signInProblemOf(info.error);
}

/**
 * The server whose session the window checks as it opens and comes forward (`useWindowSessionCheck`): its place's
 * (`serverOfPlace`), or, for a workspace whose info couldn't be read for a sign-in, that sign-in's server, so coming
 * back to the window after signing in elsewhere opens it. None on the home screen.
 */
export function serverToKeepChecking(place: Place | null, info: WorkspaceInfoRead): string | undefined {
  if (!place) return undefined;
  return serverOfPlace(place, info.data) ?? workspaceSignInProblem(info)?.server;
}
