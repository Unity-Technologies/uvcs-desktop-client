import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { repositoryPlace, workspacePlace } from '@shared/domain/place';
import type { SavedWindowBounds } from '@shared/domain/settings';
import { EVENT_CHANNEL } from '@shared/ipc';
import { memorySettings } from '../settings/testing/memorySettings';
import { createMainWindow } from './createMainWindow';
import { loadWindowBounds } from './savedWindowBounds';
import { closeEvent, fakeElectron, type FakeWindow } from './testing/fakeElectron';

vi.mock('electron', async () => (await import('./testing/fakeElectron')).fakeElectron.module);
/** What each `close` listener `keepWindowBoundsSaved` registered saw: whether the close was held back already. */
const boundsSavedOnClose = vi.hoisted(() => [] as boolean[]);

vi.mock('./savedWindowBounds', () => ({
  loadWindowBounds: vi.fn(() => ({ bounds: null, maximized: false })),
  cascadedWindowBounds: () => ({ bounds: null, maximized: false }),
  // Fitting to the displays is `restoreWindowBounds`'s, tested on its own: here the saved bounds come back as they were.
  reopenedWindowBounds: ({ maximized, ...bounds }: SavedWindowBounds) => ({ bounds, maximized }),
  keepWindowBoundsSaved: (window: FakeWindow) => window.on('close', (event: { defaultPrevented: boolean }) => boundsSavedOnClose.push(event.defaultPrevented)),
}));

/** The window `createMainWindow` made. */
function open(): FakeWindow {
  createMainWindow(memorySettings());
  return fakeElectron.windows().at(-1)!;
}

beforeEach(() => {
  fakeElectron.reset();
  boundsSavedOnClose.length = 0;
});

const PLATFORM = process.platform;

/** Has the window logic run on another OS: `createMainWindow` reads `process.platform` for the title bar it draws. */
function runOn(platform: NodeJS.Platform): void {
  Object.defineProperty(process, 'platform', { value: platform });
}

afterEach(() => runOn(PLATFORM));

describe('createMainWindow', () => {
  it("lets the close request hold a close back before the window's other close listeners hear it", () => {
    createMainWindow(memorySettings(), { onCloseRequested: (_windowId, event) => event.preventDefault() });

    fakeElectron.windows().at(-1)!.emit('close', closeEvent());
    expect(boundsSavedOnClose).toEqual([true]);
  });

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

  it('starts the page on the place the window was opened for, and on the home screen without one', () => {
    createMainWindow(memorySettings(), { place: workspacePlace('/work/game') });
    createMainWindow(memorySettings(), { place: repositoryPlace('game@local') });
    createMainWindow(memorySettings());

    expect(fakeElectron.windows().map((window) => window.loadedQuery)).toEqual([{ workspace: '/work/game' }, { repository: 'game@local' }, {}]);
  });

  it("starts a page window's page on the page it shows, where the last page window was left", () => {
    const page = { kind: 'diff', title: 'Changeset 7', target: { kind: 'changeset', changesetId: 7 } };
    vi.mocked(loadWindowBounds).mockClear();
    createMainWindow(memorySettings(), { place: workspacePlace('/work/game'), page });

    expect(fakeElectron.windows().at(-1)!.loadedQuery).toEqual({ workspace: '/work/game', page: JSON.stringify(page) });
    expect(vi.mocked(loadWindowBounds).mock.calls[0]?.[1]).toBe('pageWindowBounds');
  });

  it("takes Windows' Back command (a mouse's back button, the Browser Back key) to the page", () => {
    const window = open();

    window.emit('app-command', {}, 'browser-backward');
    window.emit('app-command', {}, 'browser-forward');
    expect(window.webContents.sent).toEqual([[EVENT_CHANNEL, 'navigateBack', {}]]);
  });

  it('shows a window whose page opens zoomed with the traffic lights centered in its top bar, and again after a reload (macOS)', () => {
    runOn('darwin');
    const window = open();
    window.webContents.zoomLevel = -2;

    window.emit('ready-to-show');
    expect(window).toMatchObject({ shown: true, windowButtonPosition: { x: 16, y: 11 } });

    window.webContents.zoomLevel = 1;
    window.webContents.emit('dom-ready');
    expect(window.windowButtonPosition).toEqual({ x: 16, y: 24 });
  });

  it('shows a window whose page opens zoomed with the caption buttons as tall as its top bar, and again after a reload (Windows)', () => {
    runOn('win32');
    const window = open();
    window.webContents.zoomLevel = -2;

    window.emit('ready-to-show');
    expect(window.titleBarOverlay).toMatchObject({ height: 36 });

    window.webContents.zoomLevel = 1;
    window.webContents.emit('dom-ready');
    expect(window.titleBarOverlay).toMatchObject({ height: 62 });
  });
});

describe('createMainWindow in an agent’s launch (`windowsStayInBackground`)', () => {
  const reopenedMaximizedFullScreen = (): FakeWindow => {
    vi.mocked(loadWindowBounds).mockReturnValueOnce({ bounds: null, maximized: true });
    createMainWindow(memorySettings(), { reopen: { bounds: { x: 0, y: 0, width: 1000, height: 700, maximized: true }, fullScreen: true } });
    const window = fakeElectron.windows().at(-1)!;
    window.emit('ready-to-show');
    return window;
  };

  afterEach(() => vi.unstubAllEnvs());

  it('shows a window without taking the focus, never maximized or full screen, its frames drawn while covered, in a build run from the checkout', () => {
    vi.stubEnv('UVCS_BACKGROUND_WINDOWS', '1');
    fakeElectron.app.isPackaged = false;

    const window = reopenedMaximizedFullScreen();
    expect(window).toMatchObject({ shown: false, shownInactive: true, maximized: false, fullScreen: false });
    expect(window.options.webPreferences?.backgroundThrottling).toBe(false);
  });

  it('saves none of its bounds, so the person’s next launch opens where they left their windows', () => {
    vi.stubEnv('UVCS_BACKGROUND_WINDOWS', '1');
    fakeElectron.app.isPackaged = false;

    reopenedMaximizedFullScreen().emit('close', closeEvent());
    expect(boundsSavedOnClose).toEqual([]);
  });

  it('shows an installed app’s window as always, whatever its environment holds', () => {
    vi.stubEnv('UVCS_BACKGROUND_WINDOWS', '1');

    const window = reopenedMaximizedFullScreen();
    expect(window).toMatchObject({ shown: true, fullScreen: true });
    expect(window.options.webPreferences).not.toHaveProperty('backgroundThrottling');
  });

  it('shows a window as always when nothing asks to keep it back', () => {
    vi.stubEnv('UVCS_BACKGROUND_WINDOWS', '');
    fakeElectron.app.isPackaged = false;

    const window = reopenedMaximizedFullScreen();
    expect(window).toMatchObject({ shown: true, fullScreen: true });
    expect(window.options.webPreferences).not.toHaveProperty('backgroundThrottling');
  });
});
