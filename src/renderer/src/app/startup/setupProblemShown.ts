import type { SetupProblem } from '@shared/domain/setup';

/**
 * How the setup check's problem (`useSetupCheck`) shows. Without a configuration `cm` can't work with any server, so
 * a screen takes the app's place (`SetupProblemScreen`). A server out of reach or a failed sign-in leave the rest
 * working (the home screen and its workspaces are local reads, other servers may answer), so they show in a corner
 * card (`SetupProblemCard`) until dismissed. Blocking the app on them left a user who was offline,
 * or whose VPN was slow, unable to open even a local workspace.
 */
export function setupProblemShown(problem: SetupProblem | null | undefined, { cardDismissed }: { cardDismissed: boolean }): 'screen' | 'card' | null {
  if (!problem) return null;
  if (problem.kind === 'notConfigured') return 'screen';
  return cardDismissed ? null : 'card';
}
