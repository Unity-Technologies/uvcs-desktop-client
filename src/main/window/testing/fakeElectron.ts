import { EventEmitter } from 'node:events';
import type { BrowserWindowConstructorOptions } from 'electron';

/**
 * Just enough of Electron's `app`, `BrowserWindow`, `nativeTheme` and `shell` for the window logic: windows open,
 * close, focus, minimize and receive events, all in memory. Tests install it with
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
  send(...args: unknown[]): void {
    this.sent.push(args);
  }
  reload(): void {
    this.reloads++;
  }
  setWindowOpenHandler(handler: WindowOpenHandler): void {
    this.openHandler = handler;
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
  shown = false;
  private destroyed = false;
  private minimized = false;

  constructor(readonly options: BrowserWindowConstructorOptions = {}) {
    super();
    this.id = state.nextId++;
    this.webContents = new FakeWebContents(this.id + 100);
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
  show(): void {
    this.shown = true;
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
  async loadURL(): Promise<void> {}
  async loadFile(): Promise<void> {}
}

const state = {
  windows: [] as FakeWindow[],
  focused: null as FakeWindow | null,
  nextId: 1,
  openedExternally: [] as string[],
};

const app = Object.assign(new EventEmitter(), { isPackaged: true, quits: 0, quit: () => void app.quits++ });

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
    app.isPackaged = true;
    app.quits = 0;
    app.removeAllListeners();
  },
};

export type FakeElectron = typeof fakeElectron;

/** Reachable from a mocked `electron` import too, for tests that load their modules afresh (`vi.resetModules`). */
Object.assign(fakeElectron.module, { fakeElectron });
