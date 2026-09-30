import { EventEmitter } from 'node:events';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BrowserWindowConstructorOptions } from 'electron';
import { EVENT_CHANNEL } from '@shared/ipc';
import { memorySettings } from '../settings/testing/memorySettings';
import { createMainWindow } from './createMainWindow';
import { loadWindowBounds } from './savedWindowBounds';

/** The window `createMainWindow` made, with what it was made with and what it was told. */
const made = vi.hoisted(() => ({ windows: [] as unknown[], openedExternally: [] as string[] }));

vi.mock('electron', async () => {
  const { EventEmitter: Emitter } = await import('node:events');
  class WebContents extends Emitter {
    id = 1;
    sent: unknown[][] = [];
    openHandler?: (details: { url: string }) => { action: string };
    isDestroyed = () => false;
    send = (...args: unknown[]) => void this.sent.push(args);
    setWindowOpenHandler = (handler: (details: { url: string }) => { action: string }) => void (this.openHandler = handler);
  }
  class BrowserWindow extends Emitter {
    webContents = new WebContents();
    maximized = false;
    shown = false;
    constructor(readonly options: BrowserWindowConstructorOptions) {
      super();
      made.windows.push(this);
    }
    maximize = () => void (this.maximized = true);
    show = () => void (this.shown = true);
    loadURL = async () => {};
    loadFile = async () => {};
  }
  return {
    BrowserWindow,
    nativeTheme: { shouldUseDarkColors: false },
    shell: { openExternal: async (url: string) => void made.openedExternally.push(url) },
  };
});
vi.mock('./savedWindowBounds', () => ({
  loadWindowBounds: vi.fn(() => ({ bounds: null, maximized: false })),
  cascadedWindowBounds: () => ({ bounds: null, maximized: false }),
  saveWindowBounds: () => {},
}));

interface MadeWindow extends EventEmitter {
  options: BrowserWindowConstructorOptions;
  maximized: boolean;
  shown: boolean;
  webContents: EventEmitter & { sent: unknown[][]; openHandler: (details: { url: string }) => { action: string } };
}

function open(): MadeWindow {
  createMainWindow(memorySettings());
  return made.windows.at(-1) as MadeWindow;
}

beforeEach(() => {
  made.windows.length = 0;
  made.openedExternally.length = 0;
});

describe('createMainWindow', () => {
  it('keeps the page untrusted: isolated from the preload, sandboxed, and without Node', () => {
    const { webPreferences } = open().options;

    expect(webPreferences).toMatchObject({ contextIsolation: true, sandbox: true });
    expect(webPreferences?.nodeIntegration).not.toBe(true);
  });

  it('never lets the page open a window of its own: a link opens outside the app', () => {
    const window = open();

    expect(window.webContents.openHandler({ url: 'https://docs.unity.com/' })).toEqual({ action: 'deny' });
    expect(made.openedExternally).toEqual(['https://docs.unity.com/']);
  });

  it('shows the window once the page can paint, maximized when it was left so', () => {
    vi.mocked(loadWindowBounds).mockReturnValueOnce({ bounds: null, maximized: true });
    const window = open();
    expect(window.options.show).toBe(false);

    window.emit('ready-to-show');
    expect(window).toMatchObject({ maximized: true, shown: true });
  });

  it("takes Windows' Back command (a mouse's back button, the Browser Back key) to the page", () => {
    const window = open();

    window.emit('app-command', {}, 'browser-backward');
    window.emit('app-command', {}, 'browser-forward');
    expect(window.webContents.sent).toEqual([[EVENT_CHANNEL, 'navigateBack', {}]]);
  });
});
