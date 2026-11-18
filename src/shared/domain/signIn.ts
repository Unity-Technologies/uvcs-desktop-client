/**
 * Why `cm` can't work with a server until the user signs in again (docs/features/accounts.md "Sign-in state"): told by
 * `signInFailureOf` from what `cm` printed, or by `cm checkconnection`.
 * - `signInRequired`: `cm` asked for a user, a password or a sign-in system: it has no sign-in for that server.
 * - `sessionEnded`: the sign-in expired and `cm` couldn't renew it.
 * - `credentialsRefused`: the server didn't accept the user or the password.
 * - `noLicense`: the user's license is deactivated, or the server has no seat left.
 * - `locked`: the server locked the account for now (too many failed attempts).
 */
export type SignInProblemKind = 'signInRequired' | 'sessionEnded' | 'credentialsRefused' | 'noLicense' | 'locked';

/** A server that needs a sign-in, and what `cm` answered that said so. */
export interface SignInProblem {
  kind: SignInProblemKind;
  /** As the window's place names it (`codice@cloud`, `localhost:8087`). */
  server: string;
  /** The command that found it and what it printed, for Details; its secrets hidden as the command log hides them. */
  details: { commandLine: string; output: string };
}

/**
 * The sign-in state of a server, kept by the main process for the whole app (`ServerSessions`): one state per server,
 * however many commands ran into it. A server not checked yet counts as signed in.
 */
export type ServerSession = { server: string; state: 'signedIn' } | { server: string; state: 'needsSignIn'; problem: SignInProblem };
