import type { SetupProblem } from '@shared/domain/setup';

/** What the corner card and its details say about a server out of reach or a failed sign-in (`SetupProblemCard`). */
export function serverProblemWords({ kind, server = 'the server' }: SetupProblem): { title: string; explanation: string } {
  if (kind === 'notSignedIn') {
    return {
      title: `You're not signed in to ${server}`,
      explanation: 'This app uses the same sign-in as the Unity Version Control app. Sign in there once, then retry.',
    };
  }
  return { title: `Can't reach ${server}`, explanation: 'Check your network or VPN connection and that the server is running, then retry.' };
}
