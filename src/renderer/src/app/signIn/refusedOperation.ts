import { create } from 'zustand';
import { samePlace, workspacePathOf, type Place } from '@shared/domain/place';
import { ApiError } from '../../api/client';
import { toast } from '../../ui/toast/toastStore';
import { useCommandLogStore } from '../shell/commandLogStore';
import { queryClient } from '../queryClient';
import { serverOfPlace } from '../workspace/placeOrigin';
import { useSession } from '../workspace/sessionStore';
import { workspaceInfoQuery } from '../workspace/useWorkspace';
import { serverInSentence } from './signInWords';
import { signInProblemOf, toldBySignInScreen } from './windowSignIn';

/**
 * What the user started, offered again once signed in: named for the offer ("Checking in 2 changes"), and run whole, as
 * the user started it (a check-in from its panel, with its catch-up and its comment cleared), never one inner step.
 */
export interface OfferedAgain {
  what: string;
  run: () => unknown;
}

/** The last operation or action the sign-in screen's server refused, to offer once signed in again. */
interface RefusedOperation {
  place: Place;
  server: string;
  again: OfferedAgain;
}

/** One at a time: the last one refused. Forgotten when the window leaves its place (`forgetRefusedOperation`). */
export const useRefusedOperation = create<{ refused: RefusedOperation | null }>(() => ({ refused: null }));

/**
 * Whether an operation or action of `place` failed only because its server needs a sign-in, which the sign-in screen
 * tells: then it raises no toast, and what its caller named to run `again` is remembered (`offerRefusedAgain`); with
 * nothing named, nothing is offered. Never run again by itself: the user sees the workspace again before it runs
 * (docs/features/accounts.md "Operations refused").
 */
export function refusedForSignIn(error: unknown, place: Place, again: OfferedAgain | undefined): boolean {
  const problem = signInProblemOf(error);
  if (!problem || !toldBySignInScreen(error, placeServerNow(place))) return false;
  useRefusedOperation.setState({ refused: again ? { place, server: problem.server, again } : null });
  markToldByScreen(error);
  return true;
}

/** Signed in again to `server`: offers the operation refused for it, once, if the window still shows its place. */
export function offerRefusedAgain(server: string, shownPlace: Place | null): void {
  const { refused } = useRefusedOperation.getState();
  if (!refused || refused.server !== server) return;
  useRefusedOperation.setState({ refused: null });
  if (!shownPlace || !samePlace(shownPlace, refused.place)) return;
  const { what, run } = refused.again;
  toast.success(`Signed in to ${serverInSentence(server).inside}`, `${what} didn't run.`, { label: 'Try again', run: () => void run() });
}

/**
 * Whether a read the user asked for failed for the sign-in the window's sign-in screen tells (its place's server's):
 * then it raises no toast of its own. A read isn't offered again: what it was for is asked again once signed in.
 */
export function readRefusedForSignIn(error: unknown): boolean {
  const place = useSession.getState().place;
  const told = place !== null && toldBySignInScreen(error, placeServerNow(place));
  if (told) markToldByScreen(error);
  return told;
}

/** The screen tells a failure it covers the window for: its command is no failure to point at (`isUnseenFailure`). */
function markToldByScreen(error: unknown): void {
  if (error instanceof ApiError && error.command) useCommandLogStore.getState().markHandled(error.command.logEntryId);
}

export function forgetRefusedOperation(): void {
  useRefusedOperation.setState({ refused: null });
}

/** The server of `place` as the window knows it now: a repository's from its spec, a workspace's from its info read. */
function placeServerNow(place: Place): string | undefined {
  const workspacePath = workspacePathOf(place);
  const info = workspacePath === null ? undefined : queryClient.getQueryData(workspaceInfoQuery(workspacePath).queryKey);
  return serverOfPlace(place, info);
}
