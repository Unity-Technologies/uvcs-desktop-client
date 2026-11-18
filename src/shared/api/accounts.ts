import type { Account } from '../domain/account';
import type { ConnectionProblem } from '../domain/setup';
import type { ServerSession } from '../domain/signIn';

/** When `accounts.checkSession` checks: at once (the user's "Check again"), or only once the last check is stale. */
export type SessionCheckWhen = 'now' | 'whenStale';

export interface AccountsApi {
  /** Every connection profile, including wildcard ones such as `*@cloud`. */
  list(): Promise<Account[]>;
  /** Deletes a connection profile: `cm` falls back to `*@cloud` or the default user, or asks to sign in again. */
  remove(name: string): Promise<void>;
  /** The servers that need a sign-in, app-wide (`ServerSessions`); `serverSessionsChanged` tells every change. */
  sessions(): Promise<ServerSession[]>;
  /**
   * Checks the sign-in to `server` (`cm checkconnection`), one check per server app-wide, joined by every window that
   * asks: `whenStale` runs none when one ran in the last ten minutes, unless the server needs a sign-in
   * (`SESSION_CHECK_STALE_MS`). Answers the server out of reach, or null; a sign-in it needs shows in `sessions`.
   */
  checkSession(server: string, when: SessionCheckWhen): Promise<ConnectionProblem | null>;
}
