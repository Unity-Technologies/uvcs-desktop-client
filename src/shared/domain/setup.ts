/** `cm` has no configuration: it can't work with any server until it's set up (`checkSetup`). */
export interface SetupProblem {
  commandLine: string;
  output: string;
  /**
   * The `cm` that runs, as a path: the app's own isn't on the PATH, so the command that sets it up in a terminal names
   * it in full (`cmCommandLine`).
   */
  cmPath: string;
}

/**
 * A server `cm checkconnection` couldn't reach (`checkConnection`): a window on it keeps working with what's local. A
 * server that needs a sign-in is a `SignInProblem` instead.
 */
export interface ConnectionProblem {
  /** The server checked, as the workspace names it (`codice@cloud`, `localhost:8087`). */
  server: string;
  commandLine: string;
  output: string;
}
