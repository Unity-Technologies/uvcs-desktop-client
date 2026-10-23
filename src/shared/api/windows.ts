import type { PageSeed, PageWindowOpening, PageWindowPage } from '../domain/pageWindow';

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
  /**
   * Pastes the clipboard where the calling window's focus is, as Edit ▸ Paste does (`webContents.paste`): the page gets
   * a real paste event, which Pierre's editor spreads across its carets in the file's line breaks. A page can't paste
   * by itself: Chromium refuses `document.execCommand('paste')`. Only the clipboard's text reaches the page, as a paste.
   */
  pasteClipboard(): Promise<void>;
  /** Opens a page of the workspace in a window of its own, belonging to this window: it closes with it. */
  openPage(opening: PageWindowOpening): Promise<void>;
  /**
   * From a page window: it shows what is selected in its workspace window from now on (`selectionToFollow`), or stops.
   * One page window of a workspace window follows at a time: another one stops (`followingChanged`).
   */
  followSelection(following: boolean): Promise<void>;
  /** What is selected in this workspace window, as the page showing its changes: the page window following it shows it. */
  selectionShown(page: PageWindowPage, seed?: PageSeed): Promise<void>;
  /** From a page window: brings its workspace window forward, and runs the command there (a view's ⌘1…) if given one. */
  showWorkspaceWindow(commandId?: string): Promise<void>;
  /** From a page window: its workspace window comes forward and opens a page only it shows (a merge: `pageRequested`). */
  openPageInWorkspaceWindow(page: PageWindowPage): Promise<void>;
  /**
   * The `uvcs://` link this window was handed (by the OS: `linkRequested`; or by another window, `openLinkIn`), once;
   * null if none. As written: the page reads it (`parseLink`) and says what's wrong with it.
   */
  takeLink(): Promise<string | null>;
  /**
   * Opens a link in a workspace (docs/features/deep-links.md, "Opening a link"): a window showing it comes forward and
   * takes the link (`handedOver`); else this window opens the workspace and the link itself when it shows the home
   * screen (`openHere`); else a new window opens on the workspace and takes the link (`handedOver`).
   */
  openLinkIn(workspacePath: string, link: string): Promise<'handedOver' | 'openHere'>;
  /** The workspaces the workspace windows show now, the most recently focused one's first. */
  shownWorkspaces(): Promise<string[]>;
}
