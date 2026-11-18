import type { Query } from '@tanstack/react-query';
import type { ServerSession, SignInProblem } from '@shared/domain/signIn';
import { ApiError } from '../../api/client';

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
