import { EventEmitter } from 'node:events';
import type { BrowserWindowConstructorOptions, TitleBarOverlayOptions } from 'electron';

/**
 * Just enough of Electron's `app`, `BrowserWindow`, `nativeTheme` and `shell` for the window logic: windows open,
 * close, focus, minimize, zoom and receive events, all in memory. Tests install it with
 * `vi.mock('electron', async () => (await import('./testing/fakeElectron')).fakeElectron.module)` and reset it before
 * each test.
 */

type WindowOpenHandler = (details: { url: string }) => { action: string };

class FakeWebContents extends EventEmitter {
  readonly sent: unknown[][] = [];
  reloads = 0;
  /** What the page gets when it opens a window or follows a link (`setWindowOpenHandler`). */
  openHandler?: WindowOpenHandler;

  constructor(readonly id: number) {
    super();
  }
  isDestroyed(): boolean {
    return false;
  }
  isLoading(): boolean {
    return false;
  }
  send(...args: unknown[]): void {
    this.sent.push(args);
  }
  reload(): void {
    this.reloads++;
  }
  setWindowOpenHandler(handler: WindowOpenHandler): void {
    this.openHandler = handler;
  }
  /** One zoom for every page, as Chromium keeps one per origin and every window's page is the same `file://` one. */
  get zoomLevel(): number {
    return state.zoomLevel;
  }
  set zoomLevel(level: number) {
    state.zoomLevel = level;
  }
  getZoomFactor(): number {
    return 1.2 ** state.zoomLevel;
  }
}

/** A `BrowserWindow`: `new BrowserWindow(options)` as the app makes one, or `fakeElectron.newWindow()` from a test. */
export class FakeWindow extends EventEmitter {
  static getAllWindows(): FakeWindow[] {
    return [...state.windows];
  }
  static getFocusedWindow(): FakeWindow | null {
    return state.focused;
  }

  readonly id: number;
  readonly webContents: FakeWebContents;
  maximized = false;
  fullScreen = false;
  shown = false;
  /** Shown without taking the focus (`showInactive`). */
  shownInactive = false;
  /** Where the window is when not maximized or full screen (`getNormalBounds`): where it was made to open. */
  normalBounds: { x: number; y: number; width: number; height: number };
  /** Where `setWindowButtonPosition` last put the traffic lights (macOS). */
  windowButtonPosition: { x: number; y: number } | null = null;
  /** What `setTitleBarOverlay` last made of the caption buttons (Windows). */
  titleBarOverlay: TitleBarOverlayOptions | null = null;
  private destroyed = false;
  private minimized = false;

  constructor(readonly options: BrowserWindowConstructorOptions = {}) {
    super();
    this.id = state.nextId++;
    this.webContents = new FakeWebContents(this.id + 100);
    const { x = 0, y = 0, width = 800, height = 600 } = options;
    this.normalBounds = { x, y, width, height };
    state.windows.push(this);
  }

  isDestroyed(): boolean {
    return this.destroyed;
  }
  isMinimized(): boolean {
    return this.minimized;
  }
  minimize(): void {
    this.minimized = true;
    if (state.focused === this) state.focused = null;
  }
  restore(): void {
    this.minimized = false;
  }
  maximize(): void {
    this.maximized = true;
  }
  isMaximized(): boolean {
    return this.maximized;
  }
  setFullScreen(fullScreen: boolean): void {
    this.fullScreen = fullScreen;
  }
  isFullScreen(): boolean {
    return this.fullScreen;
  }
  getNormalBounds(): { x: number; y: number; width: number; height: number } {
    return { ...this.normalBounds };
  }
  show(): void {
    this.shown = true;
  }
  setWindowButtonPosition(position: { x: number; y: number } | null): void {
    this.windowButtonPosition = position;
  }
  setTitleBarOverlay(options: TitleBarOverlayOptions): void {
    this.titleBarOverlay = options;
  }
  showInactive(): void {
    this.shownInactive = true;
  }
  focus(): void {
    state.focused = this;
    this.emit('focus');
  }
  close(): void {
    this.emit('close');
    this.destroyed = true;
    state.windows = state.windows.filter((window) => window !== this);
    if (state.focused === this) state.focused = null;
    this.emit('closed');
  }
  /** The page's address query (`loadFile(path, { query })`). */
  loadedQuery: Record<string, string> | undefined;
  async loadURL(): Promise<void> {}
  async loadFile(_path: string, options?: { query?: Record<string, string> }): Promise<void> {
    this.loadedQuery = options?.query;
  }
}

const state = {
  windows: [] as FakeWindow[],
  focused: null as FakeWindow | null,
  nextId: 1,
  openedExternally: [] as string[],
  zoomLevel: 0,
};

const app = Object.assign(new EventEmitter(), {
  isPackaged: true,
  /** Whether Electron finished starting (`app.isReady()`). */
  ready: false,
  isReady: () => app.ready,
  quits: 0,
  quit: () => void app.quits++,
});

export const fakeElectron = {
  module: {
    app,
    BrowserWindow: FakeWindow,
    nativeTheme: { shouldUseDarkColors: false },
    shell: { openExternal: async (url: string) => void state.openedExternally.push(url) },
  },
  app,
  /** A new window, as `createMainWindow` would make. */
  newWindow: (): FakeWindow => new FakeWindow(),
  windows: (): FakeWindow[] => [...state.windows],
  focused: (): FakeWindow | null => state.focused,
  /** The URLs opened outside the app (`shell.openExternal`), in order. */
  openedExternally: (): string[] => [...state.openedExternally],
  reset(): void {
    state.windows = [];
    state.focused = null;
    state.nextId = 1;
    state.openedExternally = [];
    state.zoomLevel = 0;
    app.isPackaged = true;
    app.ready = false;
    app.quits = 0;
    app.removeAllListeners();
  },
};

export type FakeElectron = typeof fakeElectron;

/** Reachable from a mocked `electron` import too, for tests that load their modules afresh (`vi.resetModules`). */
Object.assign(fakeElectron.module, { fakeElectron });
