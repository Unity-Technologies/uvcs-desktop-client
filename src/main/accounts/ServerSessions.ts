import type { ServerSession, SignInProblem } from '@shared/domain/signIn';

type SessionsListener = (sessions: ServerSession[]) => void;

/**
 * The sign-in state of each server, one for the whole app (docs/features/accounts.md "Sign-in state"): every window
 * and every command goes by it, however many commands ran into the same problem. It holds the servers that need a
 * sign-in; any other counts as signed in. Tells its listeners only when a server's state changes.
 */
export class ServerSessions {
  private readonly needingSignIn = new Map<string, SignInProblem>();
  private readonly listeners = new Set<SessionsListener>();

  of(server: string): ServerSession {
    const problem = this.needingSignIn.get(server);
    return problem ? { server, state: 'needsSignIn', problem } : { server, state: 'signedIn' };
  }

  /** Every server that needs a sign-in, in the order each was found. */
  all(): ServerSession[] {
    return [...this.needingSignIn.keys()].map((server) => this.of(server));
  }

  /** The server needs a sign-in, for `problem`'s reason. The same reason told again changes nothing. */
  needsSignIn(problem: SignInProblem): void {
    if (this.needingSignIn.get(problem.server)?.kind === problem.kind) return;
    this.needingSignIn.set(problem.server, problem);
    this.changed();
  }

  /** The server answered signed in; returns whether it needed a sign-in until now. */
  signedIn(server: string): boolean {
    if (!this.needingSignIn.delete(server)) return false;
    this.changed();
    return true;
  }

  onChange(listener: SessionsListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private changed(): void {
    const sessions = this.all();
    this.listeners.forEach((listener) => listener(sessions));
  }
}
