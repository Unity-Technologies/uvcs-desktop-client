import type { PageWindowOpening, PageWindowPage } from '../domain/pageWindow';

/**
 * One window per workspace, and the page windows it opened (a diff, a history… in a window of its own: `openPage`),
 * which belong to it.
 */
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
  /** Opens a page of the workspace in a window of its own, belonging to this window: it closes with it. */
  openPage(opening: PageWindowOpening): Promise<void>;
  /**
   * From a page window: it shows what is selected in its workspace window from now on (`selectionToFollow`), or stops.
   * One page window of a workspace window follows at a time: another one stops (`followingChanged`).
   */
  followSelection(following: boolean): Promise<void>;
  /** What is selected in this workspace window, as the page showing its changes: the page window following it shows it. */
  selectionShown(page: PageWindowPage): Promise<void>;
  /** From a page window: brings its workspace window forward, and runs the command there (a view's ⌘1…) if given one. */
  showWorkspaceWindow(commandId?: string): Promise<void>;
}
