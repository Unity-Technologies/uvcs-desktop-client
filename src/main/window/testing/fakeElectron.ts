import { EventEmitter } from 'node:events';

/**
 * Just enough of Electron's `app` and `BrowserWindow` for the window logic: windows open, close, focus, minimize and
 * receive events, all in memory. Tests install it with `vi.mock('electron', () => fakeElectron.module)` and reset it
 * before each test.
 */
class FakeWebContents extends EventEmitter {
  readonly sent: unknown[][] = [];
  reloads = 0;
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
}

export class FakeWindow extends EventEmitter {
  readonly webContents: FakeWebContents;
  private destroyed = false;
  private minimized = false;

  constructor(readonly id: number) {
    super();
    this.webContents = new FakeWebContents(id + 100);
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
  show(): void {}
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
}

const state = {
  windows: [] as FakeWindow[],
  focused: null as FakeWindow | null,
  nextId: 1,
};

const app = Object.assign(new EventEmitter(), { isPackaged: true, quits: 0, quit: () => void app.quits++ });

export const fakeElectron = {
  module: {
    app,
    BrowserWindow: {
      getAllWindows: () => [...state.windows],
      getFocusedWindow: () => state.focused,
    },
  },
  app,
  /** A new window, as `createMainWindow` would make. */
  newWindow: (): FakeWindow => new FakeWindow(state.nextId++),
  windows: (): FakeWindow[] => [...state.windows],
  focused: (): FakeWindow | null => state.focused,
  reset(): void {
    state.windows = [];
    state.focused = null;
    state.nextId = 1;
    app.isPackaged = true;
    app.quits = 0;
    app.removeAllListeners();
  },
};

export type FakeElectron = typeof fakeElectron;

/** Reachable from a mocked `electron` import too, for tests that load their modules afresh (`vi.resetModules`). */
Object.assign(fakeElectron.module, { fakeElectron });
