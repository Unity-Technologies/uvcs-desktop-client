import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SavedWindowBounds } from '@shared/domain/settings';
import { EVENT_CHANNEL } from '@shared/ipc';
import { memorySettings } from '../settings/testing/memorySettings';
import { createMainWindow } from './createMainWindow';
import { loadWindowBounds } from './savedWindowBounds';
import { fakeElectron, type FakeWindow } from './testing/fakeElectron';

vi.mock('electron', async () => (await import('./testing/fakeElectron')).fakeElectron.module);
vi.mock('./savedWindowBounds', () => ({
  loadWindowBounds: vi.fn(() => ({ bounds: null, maximized: false })),
  cascadedWindowBounds: () => ({ bounds: null, maximized: false }),
  // Fitting to the displays is `restoreWindowBounds`'s, tested on its own: here the saved bounds come back as they were.
  reopenedWindowBounds: ({ maximized, ...bounds }: SavedWindowBounds) => ({ bounds, maximized }),
  keepWindowBoundsSaved: () => {},
}));

/** The window `createMainWindow` made. */
function open(): FakeWindow {
  createMainWindow(memorySettings());
  return fakeElectron.windows().at(-1)!;
}

beforeEach(() => fakeElectron.reset());

describe('createMainWindow', () => {
  it('keeps the page untrusted: isolated from the preload, sandboxed, and without Node', () => {
    const { webPreferences } = open().options;

    expect(webPreferences).toMatchObject({ contextIsolation: true, sandbox: true });
    expect(webPreferences?.nodeIntegration).not.toBe(true);
  });

  it('never lets the page open a window of its own: a link opens outside the app', () => {
    const window = open();

    expect(window.webContents.openHandler!({ url: 'https://docs.unity.com/' })).toEqual({ action: 'deny' });
    expect(fakeElectron.openedExternally()).toEqual(['https://docs.unity.com/']);
  });

  it('shows the window once the page can paint, maximized when it was left so', () => {
    vi.mocked(loadWindowBounds).mockReturnValueOnce({ bounds: null, maximized: true });
    const window = open();
    expect(window.options.show).toBe(false);

    window.emit('ready-to-show');
    expect(window).toMatchObject({ maximized: true, shown: true });
  });

  it('reopens a window where it was when the app quit, full screen if it was', () => {
    const bounds = { x: 1300, y: 40, width: 1000, height: 700, maximized: false };
    vi.mocked(loadWindowBounds).mockClear();
    createMainWindow(memorySettings(), { reopen: { bounds, fullScreen: true } });
    const window = fakeElectron.windows().at(-1)!;
    expect(window.options).toMatchObject({ x: 1300, y: 40, width: 1000, height: 700 });
    expect(loadWindowBounds).not.toHaveBeenCalled();

    window.emit('ready-to-show');
    expect(window).toMatchObject({ shown: true, fullScreen: true });
  });

  it('shows a window reopened behind another without taking the focus', () => {
    const bounds = { x: 0, y: 0, width: 1200, height: 800, maximized: false };
    createMainWindow(memorySettings(), { reopen: { bounds, fullScreen: false }, inBackground: true });
    const window = fakeElectron.windows().at(-1)!;

    window.emit('ready-to-show');
    expect(window).toMatchObject({ shown: false, shownInactive: true, fullScreen: false });
  });

  it('starts the page on the workspace the window was opened for, and on the home screen without one', () => {
    createMainWindow(memorySettings(), { workspacePath: '/work/game' });
    createMainWindow(memorySettings());

    expect(fakeElectron.windows().map((window) => window.loadedQuery)).toEqual([{ workspace: '/work/game' }, {}]);
  });

  it("takes Windows' Back command (a mouse's back button, the Browser Back key) to the page", () => {
    const window = open();

    window.emit('app-command', {}, 'browser-backward');
    window.emit('app-command', {}, 'browser-forward');
    expect(window.webContents.sent).toEqual([[EVENT_CHANNEL, 'navigateBack', {}]]);
  });
});
