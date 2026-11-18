import type { ConnectionProblem } from '@shared/domain/setup';
import type { SignInProblem } from '@shared/domain/signIn';
import type { ConnectionCheck } from '../cm/connectionCheck';
import type { ServerSessions } from './ServerSessions';

/**
 * A server checked this recently is checked again only on the user's "Check again", or while it needs a sign-in: a
 * window brought forward any later checks it (`whenStale`), which also keeps the session alive, as `cm` renews it on
 * use (docs/features/accounts.md "Keeping sessions alive").
 */
export const SESSION_CHECK_STALE_MS = 10 * 60_000;

export interface SessionCheckDeps {
  /** `cm checkconnection <server>` (`checkConnection`). */
  check: (server: string) => Promise<ConnectionCheck>;
  sessions: ServerSessions;
  /** A server signed in again: the `cm shell` sessions read their sign-in again (`CmClient.restartShells`). */
  signedInAgain: () => void;
  now?: () => number;
}

interface LastCheck {
  startedAt: number;
  /** The server out of reach, or null when it answered (signed in or not). */
  unreachable: ConnectionProblem | null;
}

/**
 * Checks servers' sessions (`cm checkconnection`) and keeps `ServerSessions` up to date: one check per server at a time,
 * app-wide, joined by whoever asks while it runs, and at most one per `SESSION_CHECK_STALE_MS` asked `whenStale`. A
 * server out of reach changes no state: it may need no sign-in at all, and a window on it keeps working with what's local.
 */
export class SessionChecks {
  private readonly running = new Map<string, Promise<ConnectionProblem | null>>();
  private readonly last = new Map<string, LastCheck>();
  private readonly now: () => number;

  constructor(private readonly deps: SessionCheckDeps) {
    this.now = deps.now ?? Date.now;
  }

  /** Checks the server now (or joins the check running); answers whether it was out of reach. */
  checkNow(server: string): Promise<ConnectionProblem | null> {
    return this.run(server);
  }

  /**
   * Checks the server unless a check started within `SESSION_CHECK_STALE_MS` answered already, which answers instead; a
   * server that needs a sign-in is checked every time, so signing in elsewhere (the Unity Version Control app, a
   * terminal) is found as the user comes back.
   */
  whenStale(server: string): Promise<ConnectionProblem | null> {
    const last = this.last.get(server);
    const fresh = last !== undefined && this.now() - last.startedAt < SESSION_CHECK_STALE_MS;
    if (fresh && this.deps.sessions.of(server).state === 'signedIn') return Promise.resolve(last.unreachable);
    return this.run(server);
  }

  /**
   * A command that started at `commandStartedAt` failed as a sign-in problem would: whether the server needs a sign-in,
   * from a check started since (the one running, or a new one), so a burst of failures costs one check.
   */
  async confirm(server: string, commandStartedAt: number): Promise<SignInProblem | null> {
    const last = this.last.get(server);
    if (this.running.has(server) || last === undefined || last.startedAt < commandStartedAt) {
      try {
        await this.run(server);
      } catch {
        // A check that fails on its own tells nothing: the command fails as it did.
        return null;
      }
    }
    const session = this.deps.sessions.of(server);
    return session.state === 'needsSignIn' ? session.problem : null;
  }

  private run(server: string): Promise<ConnectionProblem | null> {
    const running = this.running.get(server);
    if (running) return running;
    const startedAt = this.now();
    const checking = this.deps
      .check(server)
      .then((check) => {
        const unreachable = this.apply(server, check);
        this.last.set(server, { startedAt, unreachable });
        return unreachable;
      })
      .finally(() => this.running.delete(server));
    this.running.set(server, checking);
    return checking;
  }

  /** What a check found, told to `ServerSessions`; the server out of reach, or null. */
  private apply(server: string, check: ConnectionCheck): ConnectionProblem | null {
    if (check.kind === 'needsSignIn') this.deps.sessions.needsSignIn(check.problem);
    if (check.kind === 'reached' && this.deps.sessions.signedIn(server)) this.deps.signedInAgain();
    return check.kind === 'unreachable' ? check.problem : null;
  }
}
