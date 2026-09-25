/** Why `cm` can run but can't work with a server yet. */
export type SetupProblemKind = 'notConfigured' | 'notSignedIn' | 'serverUnreachable';

export interface SetupProblem {
  kind: SetupProblemKind;
  /** The server `cm` tried, when its output names it. */
  server?: string;
  commandLine: string;
  output: string;
}
