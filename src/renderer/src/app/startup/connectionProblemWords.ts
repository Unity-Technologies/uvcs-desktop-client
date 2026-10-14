import type { ConnectionProblem } from '@shared/domain/setup';

/** What the connection problem card and its details say (`ConnectionProblemCard`), naming the workspace's server. */
export function connectionProblemWords({ kind, server }: ConnectionProblem): { title: string; explanation: string } {
  if (kind === 'notSignedIn') {
    return {
      title: `You're not signed in to ${server}`,
      explanation: 'This app uses the same sign-in as the Unity Version Control app. Sign in there once, then retry.',
    };
  }
  return { title: `Can't reach ${server}`, explanation: 'Check your network or VPN connection and that the server is running, then retry.' };
}
