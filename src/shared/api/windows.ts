import type { PageSeed, PageWindowOpening, PageWindowPage } from '../domain/pageWindow';
import type { Place } from '../domain/place';

/**
 * One window per place (a workspace, or a repository explored without one), and the page windows it opened (a diff,
 * a history… in a window of its own: `openPage`), which belong to it.
 */
export interface WindowsApi {
  /** Opens the place in a new window, or brings forward the window that already shows it. */
  openPlace(place: Place): Promise<void>;
  /** Brings forward another window showing the place; false when none does (open it here). */
  focusPlace(place: Place): Promise<boolean>;
  /**
   * This window explores `repository` without a workspace now, or stopped (null): as watching a workspace
   * (`workspaces.watch`) tells main the workspace a window shows.
   */
  exploring(repository: string | null): Promise<void>;
  /** Opens a new window on the home screen. */
  openHome(): Promise<void>;
  /** Answers `leaveRequested`: the window closes, the app quits or the page reloads as asked; nothing when false. */
  continueLeaving(canLeave: boolean): Promise<void>;
  /** The view the window shows now (a `ViewId`): restarting to install an update opens the window on it again. */
  viewShown(view: string): Promise<void>;
  /** Opens the menu bar's menus at a point of the window (in page pixels), where the window has no menu bar (Windows). */
  showAppMenu(position: { x: number; y: number }): Promise<void>;
  /** Opens a page of the place in a window of its own, belonging to this window: it closes with it. */
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
   * Opens a link in a place (docs/features/deep-links.md, "Opening a link"): a window showing it comes forward and
   * takes the link (`handedOver`); else this window opens the place and the link itself when it shows the home screen
   * (`openHere`); else a new window opens on the place and takes the link (`handedOver`).
   */
  openLinkIn(place: Place, link: string): Promise<'handedOver' | 'openHere'>;
  /** The workspaces the workspace windows show now, the most recently focused one's first. */
  shownWorkspaces(): Promise<string[]>;
}
