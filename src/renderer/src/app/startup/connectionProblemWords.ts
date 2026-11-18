import type { ConnectionProblem } from '@shared/domain/setup';

/** What the card of a server out of reach and its details say (`ConnectionProblemCard`), naming the server. */
export function connectionProblemWords({ server }: ConnectionProblem): { title: string; explanation: string } {
  return { title: `Can't reach ${server}`, explanation: 'Check your network or VPN connection and that the server is running, then retry.' };
}
