import { create } from 'zustand';
import { samePlace, workspacePathOf, type Place } from '@shared/domain/place';
import { toast } from '../../ui/toast/toastStore';
import { queryClient } from '../queryClient';
import { serverOfPlace } from '../workspace/placeOrigin';
import { workspaceInfoQuery } from '../workspace/useWorkspace';
import { signInProblemOf, toldBySignInScreen } from './windowSignIn';

/** The last operation or action the sign-in screen's server refused, to offer once signed in again. */
export interface RefusedOperation {
  place: Place;
  server: string;
  /** What the offer says of it: "Checking in didn't run." */
  detail: string;
  /** Runs it again, as the user started it. */
  again: () => void;
}

/** One at a time: the last one refused. Forgotten when the window leaves its place (`forgetRefusedOperation`). */
export const useRefusedOperation = create<{ refused: RefusedOperation | null }>(() => ({ refused: null }));

/**
 * Whether an operation or action of `place` failed only because its server needs a sign-in, which the sign-in screen
 * tells: then it raises no toast, and is remembered (`offerRefusedAgain`). Never run again by itself: the user sees the
 * workspace again before it runs (docs/features/accounts.md "Operations refused").
 */
export function refusedForSignIn(error: unknown, place: Place, refused: Pick<RefusedOperation, 'detail' | 'again'>): boolean {
  const problem = signInProblemOf(error);
  if (!problem || !toldBySignInScreen(error, placeServerNow(place))) return false;
  useRefusedOperation.setState({ refused: { place, server: problem.server, ...refused } });
  return true;
}

/** Signed in again to `server`: offers the operation refused for it, once, if the window still shows its place. */
export function offerRefusedAgain(server: string, shownPlace: Place | null): void {
  const { refused } = useRefusedOperation.getState();
  if (!refused || refused.server !== server) return;
  useRefusedOperation.setState({ refused: null });
  if (!shownPlace || !samePlace(shownPlace, refused.place)) return;
  toast.success(`Signed in to ${server}`, refused.detail, { label: 'Try again', run: refused.again });
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
