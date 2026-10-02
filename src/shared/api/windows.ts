/** One window per workspace. */
export interface WindowsApi {
  /** Opens the workspace in a new window, or brings forward the window that already shows it. */
  openWorkspace(workspacePath: string): Promise<void>;
  /** Brings forward another window showing the workspace; false when none does (open it here). */
  focusWorkspace(workspacePath: string): Promise<boolean>;
  /** Opens a new window on the home screen. */
  openHome(): Promise<void>;
  /** Answers `leaveRequested`: the window closes, the app quits or the page reloads as asked; nothing when false. */
  continueLeaving(canLeave: boolean): Promise<void>;
  /** The view the window shows now (a `ViewId`): restarting to install an update opens the window on it again. */
  viewShown(view: string): Promise<void>;
  /** Opens the menu bar's menus at a point of the window (in page pixels), where the window has no menu bar (Windows). */
  showAppMenu(position: { x: number; y: number }): Promise<void>;
}
