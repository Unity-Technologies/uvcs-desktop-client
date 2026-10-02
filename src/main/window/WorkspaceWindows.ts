import { existsSync } from 'node:fs';
import { app, BrowserWindow } from 'electron';
import type { SavedWindow } from '@shared/domain/settings';
import { sendEventTo } from '../ipc/sendEvent';
import type { SettingsStore } from '../settings/SettingsStore';
import { createMainWindow } from './createMainWindow';
import { askBeforeUnloading } from './leaveRequests';
import { savedBoundsOf } from './savedWindowBounds';
import { inSessionOrder, windowsToReopen } from './windowSession';

interface WorkspaceWindowsOptions {
  settings: SettingsStore;
  /** The workspace a window's page shows (by web contents id); undefined on the home screen. */
  workspaceOf: (viewer: number) => string | undefined;
  /** A window opened, closed, got focus or changed title: the Window menu lists them. */
  onWindowsChanged: () => void;
  onClosed: (viewer: number) => void;
  /** The last open window is closing, still open (`Quitting.lastWindowClosing`). */
  onLastWindowClosing: () => void;
}

/** Where a window opens again at launch, as it was when the app quit (`createMainWindow`'s `reopen`). */
interface Reopening {
  reopen: SavedWindow;
  inBackground: boolean;
}

/**
 * One window per workspace: opening a workspace that another window shows focuses that window. A new window may
 * be asked to open a workspace as soon as its page starts (`takeRequested`). The windows open as the app quits open
 * again at the next launch (`saveSession`, `openFirst`).
 */
export class WorkspaceWindows {
  private readonly requested = new Map<number, string>();
  /** A workspace picked from the Dock or named on the command line before any window existed (it launched the app). */
  private launchRequest: string | null = null;
  /** The window that had the focus last: it keeps it when the session opens again, as the app may quit from the Dock. */
  private lastFocused: BrowserWindow | null = null;
  /** The view each window's page shows (`viewShown`, by web contents id), kept for a restart to install an update. */
  private readonly views = new Map<number, string>();

  constructor(private readonly options: WorkspaceWindowsOptions) {}

  /** Opens a window on the home screen, or opening `workspacePath`; one reopened at launch opens where it was. */
  open(workspacePath?: string, reopening?: Reopening): BrowserWindow {
    const cascadeFrom = reopening ? undefined : (BrowserWindow.getFocusedWindow() ?? this.all().at(-1));
    // Its page starts on the workspace when its folder is there; for a missing one, the page's own check explains it.
    const startsOn = workspacePath && existsSync(workspacePath) ? workspacePath : undefined;
    const window = createMainWindow(this.options.settings, { cascadeFrom, workspacePath: startsOn, ...reopening });
    const viewer = window.webContents.id;
    askBeforeUnloading(window);
    if (workspacePath) this.requested.set(viewer, workspacePath);
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
      this.views.delete(viewer);
      if (this.lastFocused === window) this.lastFocused = null;
      this.options.onClosed(viewer);
      changed();
    });
    changed();
    return window;
  }

  /**
   * The workspace the window focused at launch opens (`openFirst`): the one that launched the app, else the one the
   * focused window showed when the app quit, else the last one used (none, for the home screen, when its folder is gone).
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
      this.open(reopen.workspacePath, { reopen, inBackground: behindAnother });
    });
    if (launchRequest) this.showWorkspace(launchRequest);
    else if (reopened.length === 0) this.open(this.lastUsedWorkspace());
  }

  /**
   * Saves the windows open now, to open again at the next launch (`openWindows`); none when every window was closed.
   * `withViews` keeps the view each one shows, for a restart to install an update: a restart the user didn't choose
   * puts them back where they were, while a launch of their own starts on Changes.
   */
  saveSession({ withViews }: { withViews: boolean }): void {
    const openWindows = inSessionOrder(this.all(), this.lastFocused).map((window): SavedWindow => {
      const workspacePath = this.workspaceIn(window);
      const saved = { workspacePath, bounds: savedBoundsOf(window), fullScreen: window.isFullScreen() };
      // The home screen has no view.
      const view = withViews && workspacePath ? this.views.get(window.webContents.id) : undefined;
      return view ? { ...saved, view } : saved;
    });
    this.options.settings.update({ openWindows });
  }

  /** The window's page shows `view` now (`windows.viewShown`). */
  viewShown(viewer: number, view: string): void {
    this.views.set(viewer, view);
  }

  /** Focuses the window showing the workspace, or opens one for it. */
  showWorkspace(workspacePath: string): void {
    const showing = this.windowShowing(workspacePath);
    if (showing) focusWindow(showing);
    else this.open(workspacePath);
  }

  /** The window showing the workspace, other than `except`. */
  windowShowing(workspacePath: string, except?: number): BrowserWindow | undefined {
    return this.all().find((window) => window.webContents.id !== except && this.shownBy(window.webContents.id) === workspacePath);
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
    const showing = this.windowShowing(workspacePath);
    if (showing) {
      focusWindow(showing);
      return;
    }
    const home = this.all().find((window) => this.shownBy(window.webContents.id) === undefined);
    if (!home) {
      this.open(workspacePath);
      return;
    }
    this.requested.set(home.webContents.id, workspacePath);
    sendEventTo(home.webContents, 'workspaceOpenRequested', {});
    focusWindow(home);
  }

  /** The workspace the first window opens (`openFirst`): the one that launched the app. */
  requestAtLaunch(workspacePath: string): void {
    this.launchRequest = workspacePath;
  }

  /** The workspace the window was asked to open, once. */
  takeRequested(viewer: number): string | null {
    const workspacePath = this.requested.get(viewer) ?? null;
    this.requested.delete(viewer);
    return workspacePath;
  }

  /** Brings the app forward: the last focused window, or a new one when all were closed. */
  focusAny(): void {
    const window = BrowserWindow.getFocusedWindow() ?? this.all().at(-1);
    if (window) focusWindow(window);
    else this.open();
  }

  /** The workspace the window shows; a window asked to open one counts as showing it while its page starts. */
  workspaceIn(window: BrowserWindow): string | undefined {
    return this.shownBy(window.webContents.id);
  }

  /** The open windows in the order they were opened. */
  all(): BrowserWindow[] {
    return BrowserWindow.getAllWindows()
      .filter((window) => !window.isDestroyed())
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

  private shownBy(viewer: number): string | undefined {
    return this.options.workspaceOf(viewer) ?? this.requested.get(viewer);
  }
}

export function focusWindow(window: BrowserWindow): void {
  if (window.isMinimized()) window.restore();
  window.show();
  window.focus();
}
