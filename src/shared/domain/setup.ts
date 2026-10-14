/** `cm` has no configuration: it can't work with any server until it's set up (`checkSetup`). */
export interface SetupProblem {
  commandLine: string;
  output: string;
}

/** Why a workspace's server can't be worked with (`checkConnection`). */
export type ConnectionProblemKind = 'notSignedIn' | 'serverUnreachable';

export interface ConnectionProblem {
  kind: ConnectionProblemKind;
  /** The server checked, as the workspace names it (`codice@cloud`, `localhost:8087`). */
  server: string;
  commandLine: string;
  output: string;
}
