import { existsSync } from 'node:fs';
import { app, BrowserWindow, type WebContents } from 'electron';
import type { PageSeed, PageWindowOpening, PageWindowPage } from '@shared/domain/pageWindow';
import { repositoryPlace, samePlace, workspacePathOf, workspacePlace, type Place } from '@shared/domain/place';
import type { SavedWindow } from '@shared/domain/settings';
import { sendEventTo } from '../ipc/sendEvent';
import type { SettingsStore } from '../settings/SettingsStore';
import { createMainWindow } from './createMainWindow';
import { askBeforeUnloading } from './leaveRequests';
import { PageWindowRegistry, type FollowChanges } from './PageWindowRegistry';
import { savedBoundsOf } from './savedWindowBounds';
import { inSessionOrder, windowsToReopen } from './windowSession';

interface WorkspaceWindowsOptions {
  settings: SettingsStore;
  /** The workspace a window's page shows (by web contents id); undefined on the home screen. */
  workspaceOf: (viewer: number) => string | undefined;
  /** A window opened, closed, got focus or changed title: the Window menu lists them. */
  onWindowsChanged: () => void;
  onClosed: (viewer: number) => void;
  /** No window explores the repository anymore: what was kept of it while one did can go. */
  onRepositoryLeft: (repository: string) => void;
  /** The last open window is closing, still open (`Quitting.lastWindowClosing`). */
  onLastWindowClosing: () => void;
}

/** Where a window opens again at launch, as it was when the app quit (`createMainWindow`'s `reopen`). */
interface Reopening {
  reopen: SavedWindow;
  inBackground: boolean;
}

/**
 * One window per place (`Place`: a workspace, or a repository explored without one): opening a place that another
 * window shows focuses that window. A new window may be asked to open a place as soon as its page starts
 * (`takeRequested`). The windows open as the app quits open again at the next launch (`saveSession`, `openFirst`).
 * A window shows a workspace while it watches it (`workspaceOf`), a repository while it says it explores it
 * (`repositoryShown`).
 *
 * A place's window may open page windows (`openPage`: a diff, a history… in a window of its own, for another
 * display). They belong to it: they close with it or once it leaves their place, aren't place windows (`all`), aren't
 * saved for the next launch, and one of them may follow its selection (`follow`).
 */
export class WorkspaceWindows {
  private readonly requested = new Map<number, Place>();
  /** The repository each window explores without a workspace, by web contents id (`repositoryShown`). */
  private readonly explored = new Map<number, string>();
  /** The `uvcs://` link each window was handed and hasn't taken yet (`takeLink`), by web contents id. */
  private readonly links = new Map<number, string>();
  /** A workspace picked from the Dock or named on the command line before any window existed (it launched the app). */
  private launchRequest: string | null = null;
  /** The window that had the focus last: it keeps it when the session opens again, as the app may quit from the Dock. */
  private lastFocused: BrowserWindow | null = null;
  /** The view each window's page shows (`viewShown`, by web contents id), kept for a restart to install an update. */
  private readonly views = new Map<number, string>();
  private readonly pages = new PageWindowRegistry();

  constructor(private readonly options: WorkspaceWindowsOptions) {}

  /** Opens a window on the home screen, or opening `place`; one reopened at launch opens where it was. */
  open(place?: Place, reopening?: Reopening): BrowserWindow {
    const cascadeFrom = reopening ? undefined : (BrowserWindow.getFocusedWindow() ?? this.all().at(-1));
    // Its page starts on a workspace when its folder is there; for a missing one, the page's own check explains it.
    const startsOn = place && (place.kind === 'repository' || existsSync(place.workspacePath)) ? place : undefined;
    const window = createMainWindow(this.options.settings, { cascadeFrom, place: startsOn, ...reopening });
    const viewer = window.webContents.id;
    askBeforeUnloading(window);
    // A page loaded again (a reload) starts not knowing a page window follows it: it's told, or it would stop showing it.
    window.webContents.on('did-finish-load', () => {
      if (this.pages.followerOf(viewer) !== undefined) sendEventTo(window.webContents, 'selectionFollowed', { followed: true });
    });
    if (place) this.requested.set(viewer, place);
    if (reopening?.reopen.view) this.views.set(viewer, reopening.reopen.view);

    const changed = (): void => this.options.onWindowsChanged();
    window.on('focus', () => {
      this.lastFocused = window;
      changed();
    });
    // The event comes before the window takes the new title.
    window.on('page-title-updated', () => setImmediate(changed));
    window.on('close', () => {
      if (this.all().length === 1) this.options.onLastWindowClosing();
    });
    window.on('closed', () => {
      this.requested.delete(viewer);
      this.stopExploring(viewer);
      this.links.delete(viewer);
      this.views.delete(viewer);
      if (this.lastFocused === window) this.lastFocused = null;
      this.pageWindowsOf(viewer).forEach((pageWindow) => pageWindow.close());
      this.options.onClosed(viewer);
      changed();
    });
    changed();
    return window;
  }

  /**
   * Opens a page of the place in a window of its own, belonging to the caller's place window (a page window opening
   * one gives it its own owner). It opens where the last page window was left, often on another display, or cascaded
   * from the last one still open, or from its place's window the first time.
   */
  openPage(caller: number, { place, page, seed }: Pick<PageWindowOpening, 'place' | 'page' | 'seed'>): BrowserWindow | undefined {
    const ownerId = this.pages.ownerOf(caller) ?? caller;
    const owner = this.byViewer(ownerId);
    if (!owner) return undefined;
    const lastPageWindow = this.pageWindowsOf(ownerId).at(-1);
    const cascadeFrom = lastPageWindow ?? (this.options.settings.get().pageWindowBounds ? undefined : owner);
    const window = createMainWindow(this.options.settings, { cascadeFrom, place, page, seed });
    const viewer = window.webContents.id;
    this.pages.add(viewer, ownerId, place);
    askBeforeUnloading(window);
    // Its page loaded again (a reload) starts with Follow selection off: it's told it's on.
    window.webContents.on('did-finish-load', () => {
      if (this.pages.isFollowing(viewer)) sendEventTo(window.webContents, 'followingChanged', { following: true });
    });

    const changed = (): void => this.options.onWindowsChanged();
    window.on('focus', changed);
    window.on('page-title-updated', () => setImmediate(changed));
    window.on('closed', () => {
      this.tell(this.pages.remove(viewer));
      this.options.onClosed(viewer);
      changed();
    });
    changed();
    return window;
  }

  /** The page windows of a workspace window, in the order they opened. */
  pageWindowsOf(owner: number): BrowserWindow[] {
    return this.pages.pageWindowsOf(owner).flatMap((viewer) => this.byViewer(viewer) ?? []);
  }

  /** The workspace window a page window belongs to; undefined for a workspace window. */
  ownerOf(viewer: number): number | undefined {
    return this.pages.ownerOf(viewer);
  }

  /** Where a window's commands are logged: its own command log, or a page window's workspace window's. */
  commandLogOf(caller: WebContents): WebContents {
    const ownerId = this.pages.ownerOf(caller.id);
    return (ownerId === undefined ? undefined : this.byViewer(ownerId)?.webContents) ?? caller;
  }

  /**
   * A window shows `workspacePath` now (none: the home screen): the page windows of the place it left close. A window
   * shows one place: one that explored a repository and made a workspace of it explores it no more.
   */
  workspaceShown(viewer: number, workspacePath: string | undefined): void {
    if (workspacePath !== undefined) this.stopExploring(viewer);
    this.placeShown(viewer, workspacePath === undefined ? undefined : workspacePlace(workspacePath));
  }

  /**
   * A window explores `repository` without a workspace now (`windows.exploring`; none: it left it), as watching a
   * workspace says it shows one: links, the Window menu, the session and its page windows go by it.
   */
  repositoryShown(viewer: number, repository: string | undefined): void {
    if (this.explored.get(viewer) !== repository) this.stopExploring(viewer);
    if (repository !== undefined) this.explored.set(viewer, repository);
    this.placeShown(viewer, repository === undefined ? undefined : repositoryPlace(repository));
    this.options.onWindowsChanged();
  }

  /** Whether a window explores `repository` without a workspace: its branch names are kept while one does. */
  explores(repository: string): boolean {
    return [...this.explored.values()].includes(repository);
  }

  /** The window explores no repository anymore; the last window to leave one lets it go (`onRepositoryLeft`). */
  private stopExploring(viewer: number): void {
    const repository = this.explored.get(viewer);
    if (repository === undefined) return;
    this.explored.delete(viewer);
    if (!this.explores(repository)) this.options.onRepositoryLeft(repository);
  }

  /** The page windows of the place a window left close. */
  private placeShown(viewer: number, place: Place | undefined): void {
    for (const pageWindow of this.pages.leftBehindBy(viewer, place)) this.byViewer(pageWindow)?.close();
  }

  /** A page window starts or stops following its workspace window's selection; both hear it, and the one it took it from. */
  follow(viewer: number, following: boolean): void {
    this.tell(this.pages.follow(viewer, following));
  }

  /** What is selected in a workspace window now: the page window following it shows it. */
  selectionShown(owner: number, page: PageWindowPage, seed?: PageSeed): void {
    const follower = this.pages.followerOf(owner);
    const window = follower === undefined ? undefined : this.byViewer(follower);
    if (window) sendEventTo(window.webContents, 'selectionToFollow', seed ? { page, seed } : { page });
  }

  /** Brings a page window's workspace window forward, running a command there (a view's ⌘1…) when given one. */
  showWorkspaceWindow(pageWindow: number, commandId?: string): void {
    const owner = this.ownerWindowOf(pageWindow);
    if (!owner) return;
    focusWindow(owner);
    if (commandId) sendEventTo(owner.webContents, 'menuCommand', { commandId });
  }

  /** Brings a page window's workspace window forward, opening there a page only it shows (a merge). */
  openInWorkspaceWindow(pageWindow: number, page: PageWindowPage): void {
    const owner = this.ownerWindowOf(pageWindow);
    if (!owner) return;
    focusWindow(owner);
    sendEventTo(owner.webContents, 'pageRequested', { page });
  }

  /**
   * The workspace the window focused at launch opens (`openFirst`): the one that launched the app, else the one the
   * focused window showed when the app quit, else the last one used (none, for the home screen or a repository
   * explored without a workspace, and when its folder is gone).
   */
  firstWorkspace(): string | undefined {
    if (this.launchRequest) return this.launchRequest;
    const reopened = this.windowsToReopen();
    return reopened.length > 0 ? reopened.at(-1)!.workspacePath : this.lastUsedWorkspace();
  }

  /**
   * The windows at launch: those open when the app quit, where they were and on what they showed, the focused one in
   * front; else one on the last workspace used. A workspace that launched the app then comes forward, in its window
   * if one reopened on it.
   */
  openFirst(): void {
    const launchRequest = this.launchRequest;
    this.launchRequest = null;
    const reopened = this.windowsToReopen();
    reopened.forEach((reopen, index) => {
      const behindAnother = index < reopened.length - 1 || launchRequest !== null;
      this.open(savedPlaceOf(reopen), { reopen, inBackground: behindAnother });
    });
    if (launchRequest) this.showPlace(workspacePlace(launchRequest));
    else if (reopened.length === 0) this.open(placeOfWorkspace(this.lastUsedWorkspace()));
  }

  /**
   * Saves the windows open now, to open again at the next launch (`openWindows`); none when every window was closed.
   * `withViews` keeps the view each one shows, for a restart to install an update: a restart the user didn't choose
   * puts them back where they were, while a launch of their own starts on Changes.
   */
  saveSession({ withViews }: { withViews: boolean }): void {
    const openWindows = inSessionOrder(this.all(), this.lastFocused).map((window): SavedWindow => {
      const place = this.placeIn(window);
      const saved = { ...savedPlaceFields(place), bounds: savedBoundsOf(window), fullScreen: window.isFullScreen() };
      // The home screen has no view.
      const view = withViews && place ? this.views.get(window.webContents.id) : undefined;
      return view ? { ...saved, view } : saved;
    });
    this.options.settings.update({ openWindows });
  }

  /** The window's page shows `view` now (`windows.viewShown`). */
  viewShown(viewer: number, view: string): void {
    this.views.set(viewer, view);
  }

  /** Focuses the window showing the place, or opens one for it. */
  showPlace(place: Place): void {
    const showing = this.windowShowing(place);
    if (showing) focusWindow(showing);
    else this.open(place);
  }

  /** The window showing the place, other than `except`. */
  windowShowing(place: Place, except?: number): BrowserWindow | undefined {
    return this.all().find((window) => {
      const shown = this.shownBy(window.webContents.id);
      return window.webContents.id !== except && shown !== undefined && samePlace(shown, place);
    });
  }

  /**
   * A workspace picked from the OS recent documents or named on the command line: its window comes forward, else a
   * window on the home screen opens it, else a new window does. Before the app is ready, the first window opens it.
   */
  requestWorkspace(workspacePath: string): void {
    if (!app.isReady()) {
      this.requestAtLaunch(workspacePath);
      return;
    }
    const place = workspacePlace(workspacePath);
    const showing = this.windowShowing(place);
    if (showing) {
      focusWindow(showing);
      return;
    }
    const home = this.all().find((window) => this.shownBy(window.webContents.id) === undefined);
    if (!home) {
      this.open(place);
      return;
    }
    this.requested.set(home.webContents.id, place);
    sendEventTo(home.webContents, 'workspaceOpenRequested', {});
    focusWindow(home);
  }

  /** The workspace the first window opens (`openFirst`): the one that launched the app. */
  requestAtLaunch(workspacePath: string): void {
    this.launchRequest = workspacePath;
  }

  /** The place the window was asked to open, once. */
  takeRequested(viewer: number): Place | null {
    const place = this.requested.get(viewer) ?? null;
    this.requested.delete(viewer);
    return place;
  }

  /** Hands a window a `uvcs://` link to open (its page takes it: `takeLink`) and brings it forward. */
  handLink(window: BrowserWindow, link: string): void {
    this.links.set(window.webContents.id, link);
    sendEventTo(window.webContents, 'linkRequested', {});
    focusWindow(window);
  }

  /** The link the window was handed, once. */
  takeLink(viewer: number): string | null {
    const link = this.links.get(viewer) ?? null;
    this.links.delete(viewer);
    return link;
  }

  /**
   * Opens a link in a place (`windows.openLinkIn`): the window showing it takes it; else the caller opens both when it
   * shows the home screen (`openHere`); else a new window on the place takes it. A link never takes a window away from
   * the place it shows.
   */
  openLinkIn(caller: number, place: Place, link: string): 'handedOver' | 'openHere' {
    const showing = this.windowShowing(place);
    if (showing) {
      this.handLink(showing, link);
      return 'handedOver';
    }
    const callerShowsHome = !this.pages.isPageWindow(caller) && this.byViewer(caller) !== undefined && this.shownBy(caller) === undefined;
    if (callerShowsHome) return 'openHere';
    this.links.set(this.open(place).webContents.id, link);
    return 'handedOver';
  }

  /** The workspaces the workspace windows show, the last focused window's first. */
  shownWorkspaces(): string[] {
    const inFocusOrder = inSessionOrder(this.all(), this.lastFocused).reverse();
    return [...new Set(inFocusOrder.flatMap((window) => this.workspaceIn(window) ?? []))];
  }

  /**
   * Hands a link the OS sent to the window in front (docs/features/deep-links.md, "Opening a link"): the focused
   * workspace window, the workspace window of a focused page window, else the last one focused or opened, else a new
   * window on the home screen. Its page finds the workspace the link needs.
   */
  openLink(link: string): void {
    const focused = BrowserWindow.getFocusedWindow();
    const owner = focused ? this.ownerWindowOf(focused.webContents.id) : undefined;
    const inFront = owner ?? (focused && !this.pages.isPageWindow(focused.webContents.id) ? focused : undefined);
    const lastUsed = this.lastFocused && !this.lastFocused.isDestroyed() ? this.lastFocused : this.all().at(-1);
    this.handLink(inFront ?? lastUsed ?? this.open(), link);
  }

  /** Brings the app forward: the last focused window, or a new one when all were closed. */
  focusAny(): void {
    const window = BrowserWindow.getFocusedWindow() ?? this.all().at(-1);
    if (window) focusWindow(window);
    else this.open();
  }

  /** The place the window shows; a window asked to open one counts as showing it while its page starts. */
  placeIn(window: BrowserWindow): Place | undefined {
    return this.shownBy(window.webContents.id);
  }

  /** The workspace the window shows; none for the home screen or a repository explored without one. */
  workspaceIn(window: BrowserWindow): string | undefined {
    const place = this.placeIn(window);
    return (place && workspacePathOf(place)) ?? undefined;
  }

  /** Whether a window shows the home screen: one whose page shows no place and wasn't asked to open one. */
  showsHomeScreen(): boolean {
    return this.all().some((window) => this.placeIn(window) === undefined);
  }

  /** The open workspace windows (and home screens) in the order they were opened, without their page windows. */
  all(): BrowserWindow[] {
    return BrowserWindow.getAllWindows()
      .filter((window) => !window.isDestroyed() && !this.pages.isPageWindow(window.webContents.id))
      .sort((a, b) => a.id - b.id);
  }

  /**
   * The saved windows to open again (`windowsToReopen`). Development builds open none, as they open no last workspace:
   * they start on the home screen, where automated UI checks pick a workspace.
   */
  private windowsToReopen(): SavedWindow[] {
    return app.isPackaged ? windowsToReopen(this.options.settings.get().openWindows, existsSync) : [];
  }

  private lastUsedWorkspace(): string | undefined {
    const lastUsed = app.isPackaged ? this.options.settings.get().recentWorkspacePaths[0] : undefined;
    return lastUsed && existsSync(lastUsed) ? lastUsed : undefined;
  }

  private ownerWindowOf(pageWindow: number): BrowserWindow | undefined {
    const ownerId = this.pages.ownerOf(pageWindow);
    return ownerId === undefined ? undefined : this.byViewer(ownerId);
  }

  private byViewer(viewer: number): BrowserWindow | undefined {
    return BrowserWindow.getAllWindows().find((window) => !window.isDestroyed() && window.webContents.id === viewer);
  }

  private tell({ pageWindows, owner }: FollowChanges): void {
    for (const { viewer, following } of pageWindows) {
      const window = this.byViewer(viewer);
      if (window) sendEventTo(window.webContents, 'followingChanged', { following });
    }
    const ownerWindow = owner && this.byViewer(owner.viewer);
    if (owner && ownerWindow) sendEventTo(ownerWindow.webContents, 'selectionFollowed', { followed: owner.followed });
  }

  private shownBy(viewer: number): Place | undefined {
    const workspacePath = this.options.workspaceOf(viewer);
    if (workspacePath !== undefined) return workspacePlace(workspacePath);
    const repository = this.explored.get(viewer);
    return repository !== undefined ? repositoryPlace(repository) : this.requested.get(viewer);
  }
}

/** A saved window's place: its workspace, or the repository it explored; none for the home screen. */
function savedPlaceOf({ workspacePath, repository }: SavedWindow): Place | undefined {
  if (workspacePath) return workspacePlace(workspacePath);
  return repository ? repositoryPlace(repository) : undefined;
}

function savedPlaceFields(place: Place | undefined): Pick<SavedWindow, 'workspacePath' | 'repository'> {
  if (!place) return {};
  return place.kind === 'workspace' ? { workspacePath: place.workspacePath } : { repository: place.repository };
}

function placeOfWorkspace(workspacePath: string | undefined): Place | undefined {
  return workspacePath === undefined ? undefined : workspacePlace(workspacePath);
}

export function focusWindow(window: BrowserWindow): void {
  if (window.isMinimized()) window.restore();
  window.show();
  window.focus();
}
