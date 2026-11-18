import type { ConnectionProblem } from '@shared/domain/setup';
import type { SignInProblem, SignInProblemKind } from '@shared/domain/signIn';
import type { ConnectionCheck } from '../cm/connectionCheck';
import type { ServerSessions } from './ServerSessions';

/**
 * A server checked this recently is checked again only on the user's "Check again", or while it needs a sign-in: a
 * window brought forward any later checks it (`whenStale`), which also keeps the session alive, as `cm` renews it on
 * use (docs/features/accounts.md "Keeping sessions alive").
 */
export const SESSION_CHECK_STALE_MS = 10 * 60_000;

/**
 * A check this recent answers the sign-in failures that follow it (`confirm`): a failing read of an xlinked server's,
 * which `cm` doesn't tell from the workspace's own, costs one check a burst, not one per read.
 */
export const CONFIRMED_REACHED_MS = 5_000;

export interface SessionCheckDeps {
  /** `cm checkconnection <server>` (`checkConnection`). */
  check: (server: string) => Promise<ConnectionCheck>;
  sessions: ServerSessions;
  /**
   * The `cm shell` sessions start again, reading the sign-in again (`CmClient.restartShells`): once a server is signed
   * in again, and once a shell's read failed for a sign-in the server's check found fine (made elsewhere meanwhile).
   */
  restartShells: () => void;
  now?: () => number;
}

/** The problems a check would only make worse, sending the refused password once more (`whenStale`). */
const RESENDS_REFUSED_PASSWORD: ReadonlySet<SignInProblemKind> = new Set(['credentialsRefused', 'locked']);

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
  /** When the shells last started again: a burst of failures from the shells they replaced restarts them once. */
  private shellsRestartedAt = Number.NEGATIVE_INFINITY;
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
   * terminal) is found as the user comes back. But not one that refused the password or locked the account: each check
   * sends the stored password again, and a few activations would lock a directory account; only Check again checks it
   * (`checkNow`).
   */
  whenStale(server: string): Promise<ConnectionProblem | null> {
    const last = this.last.get(server);
    const session = this.deps.sessions.of(server);
    if (session.state === 'needsSignIn' && RESENDS_REFUSED_PASSWORD.has(session.problem.kind)) return Promise.resolve(last?.unreachable ?? null);
    const fresh = last !== undefined && this.now() - last.startedAt < SESSION_CHECK_STALE_MS;
    if (fresh && session.state === 'signedIn') return Promise.resolve(last.unreachable);
    return this.run(server);
  }

  /**
   * A command that started at `commandStartedAt` failed as a sign-in problem would: whether the server needs a sign-in,
   * from a check started since (the one running, or a new one), or within `CONFIRMED_REACHED_MS`, so a burst of
   * failures costs one check. A server known to need one answers at once: the failure is what that state says (a local
   * command still runs, and fails so). A pooled `cm shell`'s failure (`ranInShell`) the check finds signed in restarts
   * the shells, once: a shell keeps the sign-in it read as it started, so one made since (in the Unity Version Control
   * app, before any check found the session ended) would never reach it.
   */
  async confirm(server: string, commandStartedAt: number, ranInShell: boolean): Promise<SignInProblem | null> {
    const known = this.deps.sessions.of(server);
    if (known.state === 'needsSignIn') return known.problem;
    const last = this.last.get(server);
    const answered = last !== undefined && (last.startedAt >= commandStartedAt || this.now() - last.startedAt < CONFIRMED_REACHED_MS);
    if (this.running.has(server) || !answered) {
      try {
        await this.run(server);
      } catch {
        // A check that fails on its own tells nothing: the command fails as it did.
        return null;
      }
    }
    const session = this.deps.sessions.of(server);
    if (session.state === 'needsSignIn') return session.problem;
    if (ranInShell && this.shellsRestartedAt < commandStartedAt) this.restartShells();
    return null;
  }

  private restartShells(): void {
    this.shellsRestartedAt = this.now();
    this.deps.restartShells();
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
    if (check.kind === 'reached' && this.deps.sessions.signedIn(server)) this.restartShells();
    return check.kind === 'unreachable' ? check.problem : null;
  }
}
