import { existsSync } from 'node:fs';
import { app, BrowserWindow } from 'electron';
import { sendEventTo } from '../ipc/sendEvent';
import type { SettingsStore } from '../settings/SettingsStore';
import { createMainWindow } from './createMainWindow';
import { askBeforeUnloading } from './leaveRequests';

interface WorkspaceWindowsOptions {
  settings: SettingsStore;
  /** The workspace a window's page shows (by web contents id); undefined on the home screen. */
  workspaceOf: (viewer: number) => string | undefined;
  /** A window opened, closed, got focus or changed title: the Window menu lists them. */
  onWindowsChanged: () => void;
  onClosed: (viewer: number) => void;
}

/**
 * One window per workspace: opening a workspace that another window shows focuses that window. A new window may
 * be asked to open a workspace as soon as its page starts (`takeRequested`).
 */
export class WorkspaceWindows {
  private readonly requested = new Map<number, string>();
  /** A workspace picked from the Dock or named on the command line before any window existed (it launched the app). */
  private launchRequest: string | null = null;

  constructor(private readonly options: WorkspaceWindowsOptions) {}

  /** Opens a window on the home screen, or opening `workspacePath`. */
  open(workspacePath?: string): BrowserWindow {
    const cascadeFrom = BrowserWindow.getFocusedWindow() ?? this.all().at(-1);
    // Its page starts on the workspace when its folder is there; for a missing one, the page's own check explains it.
    const startsOn = workspacePath && existsSync(workspacePath) ? workspacePath : undefined;
    const window = createMainWindow(this.options.settings, { cascadeFrom, workspacePath: startsOn });
    const viewer = window.webContents.id;
    askBeforeUnloading(window);
    if (workspacePath) this.requested.set(viewer, workspacePath);

    const changed = (): void => this.options.onWindowsChanged();
    window.on('focus', changed);
    // The event comes before the window takes the new title.
    window.on('page-title-updated', () => setImmediate(changed));
    window.on('closed', () => {
      this.requested.delete(viewer);
      this.options.onClosed(viewer);
      changed();
    });
    changed();
    return window;
  }

  /**
   * The workspace the first window at launch opens: the one that launched the app, else the last one used (none, for
   * the home screen, when its folder is gone). Development builds start on the home screen, where automated UI checks
   * pick a workspace.
   */
  firstWorkspace(): string | undefined {
    const lastUsed = app.isPackaged ? this.options.settings.get().recentWorkspacePaths[0] : undefined;
    return this.launchRequest ?? (lastUsed && existsSync(lastUsed) ? lastUsed : undefined);
  }

  /** The first window at launch, on `firstWorkspace()`. */
  openFirst(): void {
    const workspacePath = this.firstWorkspace();
    this.launchRequest = null;
    this.open(workspacePath);
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

  private shownBy(viewer: number): string | undefined {
    return this.options.workspaceOf(viewer) ?? this.requested.get(viewer);
  }
}

export function focusWindow(window: BrowserWindow): void {
  if (window.isMinimized()) window.restore();
  window.show();
  window.focus();
}
