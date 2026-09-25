/** One window per workspace. */
export interface WindowsApi {
  /** Opens the workspace in a new window, or brings forward the window that already shows it. */
  openWorkspace(workspacePath: string): Promise<void>;
  /** Brings forward another window showing the workspace; false when none does (open it here). */
  focusWorkspace(workspacePath: string): Promise<boolean>;
  /** Opens a new window on the home screen. */
  openHome(): Promise<void>;
}
