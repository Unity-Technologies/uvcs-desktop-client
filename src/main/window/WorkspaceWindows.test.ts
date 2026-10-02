import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BrowserWindow } from 'electron';
import type { SavedWindow } from '@shared/domain/settings';
import { EVENT_CHANNEL } from '@shared/ipc';
import { memorySettings } from '../settings/testing/memorySettings';
import { createMainWindow } from './createMainWindow';
import { fakeElectron, type FakeWindow } from './testing/fakeElectron';
import { WorkspaceWindows } from './WorkspaceWindows';

vi.mock('electron', async () => (await import('./testing/fakeElectron')).fakeElectron.module);
vi.mock('./createMainWindow', async () => {
  const { fakeElectron } = await import('./testing/fakeElectron');
  return { createMainWindow: vi.fn(() => fakeElectron.newWindow()) };
});

const GAME = join('/work', 'game');
const TOOLS = join('/work', 'tools');

beforeEach(() => {
  fakeElectron.reset();
  fakeElectron.app.ready = true;
  vi.mocked(createMainWindow).mockClear();
});

/** The windows, with each page saying which workspace it shows (`shows`). */
function setUp(recentWorkspacePaths: string[] = [], openWindows: SavedWindow[] = []) {
  const shown = new Map<number, string>();
  const onWindowsChanged = vi.fn();
  const onClosed = vi.fn();
  const onLastWindowClosing = vi.fn();
  const settings = memorySettings({ recentWorkspacePaths, openWindows });
  const windows = new WorkspaceWindows({
    settings,
    onLastWindowClosing,
    workspaceOf: (viewer) => shown.get(viewer),
    onWindowsChanged,
    onClosed,
  });
  const open = (workspacePath?: string): FakeWindow => windows.open(workspacePath) as unknown as FakeWindow;
  /** The page of `window` now shows `workspacePath` (after taking its request, or picked on the home screen). */
  const shows = (window: FakeWindow, workspacePath: string): void => void shown.set(window.webContents.id, workspacePath);
  return { windows, settings, open, shows, onWindowsChanged, onClosed, onLastWindowClosing };
}

const asBrowserWindow = (window: FakeWindow): BrowserWindow => window as unknown as BrowserWindow;

describe('one window per workspace', () => {
  it('brings forward the window showing a workspace instead of opening another, restored if minimized', () => {
    const { windows, open, shows } = setUp();
    const game = open();
    shows(game, GAME);
    open();
    game.minimize();

    windows.showWorkspace(GAME);
    expect(fakeElectron.windows()).toHaveLength(2);
    expect(fakeElectron.focused()).toBe(game);
    expect(game.isMinimized()).toBe(false);
  });

  it("opens a window for a workspace no window shows, which takes it once as its page starts", () => {
    const { windows } = setUp();

    windows.showWorkspace(GAME);
    const [window] = fakeElectron.windows();
    expect(windows.workspaceIn(asBrowserWindow(window!))).toBe(GAME);
    // Showing it while its page starts: asking again brings it forward instead of opening a second one.
    windows.showWorkspace(GAME);
    expect(fakeElectron.windows()).toHaveLength(1);

    expect(windows.takeRequested(window!.webContents.id)).toBe(GAME);
    expect(windows.takeRequested(window!.webContents.id)).toBeNull();
  });

  it("starts a new window's page on its workspace when the folder is there, else the page checks it itself", () => {
    const { windows } = setUp();
    const game = mkdtempSync(join(tmpdir(), 'uvcs-game-'));

    windows.showWorkspace(game);
    windows.showWorkspace(join(tmpdir(), 'uvcs-deleted-workspace'));
    expect(vi.mocked(createMainWindow).mock.calls.map(([, options]) => options?.workspacePath)).toEqual([game, undefined]);
  });

  it('finds the window showing a workspace, other than the one asking', () => {
    const { windows, open, shows } = setUp();
    const game = open();
    shows(game, GAME);

    expect(windows.windowShowing(GAME)).toBe(asBrowserWindow(game));
    expect(windows.windowShowing(GAME, game.webContents.id)).toBeUndefined();
    expect(windows.windowShowing(TOOLS)).toBeUndefined();
  });
});

describe('a workspace requested from the OS (recent documents, the command line)', () => {
  it('goes to a window on the home screen, which is told and comes forward', () => {
    const { windows, open, shows } = setUp();
    shows(open(), TOOLS);
    const home = open();

    windows.requestWorkspace(GAME);
    expect(fakeElectron.windows()).toHaveLength(2);
    expect(fakeElectron.focused()).toBe(home);
    expect(home.webContents.sent).toEqual([[EVENT_CHANNEL, 'workspaceOpenRequested', {}]]);
    expect(windows.takeRequested(home.webContents.id)).toBe(GAME);
  });

  it('opens a new window when every window shows another workspace', () => {
    const { windows, open, shows } = setUp();
    shows(open(), TOOLS);

    windows.requestWorkspace(GAME);
    expect(fakeElectron.windows()).toHaveLength(2);
  });

  it('brings forward the window already showing it', () => {
    const { windows, open, shows } = setUp();
    const game = open();
    shows(game, GAME);
    open();

    windows.requestWorkspace(GAME);
    expect(fakeElectron.windows()).toHaveLength(2);
    expect(fakeElectron.focused()).toBe(game);
  });

  it('opens in the first window when it launched the app, once', () => {
    const { windows } = setUp();
    fakeElectron.app.ready = false;

    windows.requestWorkspace(GAME);
    expect(fakeElectron.windows()).toEqual([]);
    fakeElectron.app.ready = true;
    windows.openFirst();
    expect(windows.takeRequested(fakeElectron.windows()[0]!.webContents.id)).toBe(GAME);

    windows.openFirst();
    expect(windows.takeRequested(fakeElectron.windows()[1]!.webContents.id)).toBeNull();
  });
});

describe('the first window at launch', () => {
  it('reopens the last workspace used', () => {
    const lastUsed = mkdtempSync(join(tmpdir(), 'uvcs-last-'));
    const { windows } = setUp([lastUsed, TOOLS]);

    windows.openFirst();
    expect(windows.takeRequested(fakeElectron.windows()[0]!.webContents.id)).toBe(lastUsed);
  });

  it('names the workspace it opens before opening it, so its `cm shell`s can start first', () => {
    const lastUsed = mkdtempSync(join(tmpdir(), 'uvcs-last-'));
    const { windows } = setUp([lastUsed]);

    expect(windows.firstWorkspace()).toBe(lastUsed);
    expect(fakeElectron.windows()).toEqual([]);
    windows.openFirst();
    expect(windows.takeRequested(fakeElectron.windows()[0]!.webContents.id)).toBe(lastUsed);
  });

  it('opens on the home screen when the last workspace used is gone', () => {
    const { windows } = setUp([join(tmpdir(), 'uvcs-deleted-workspace')]);

    expect(windows.firstWorkspace()).toBeUndefined();
    windows.openFirst();
    expect(windows.takeRequested(fakeElectron.windows()[0]!.webContents.id)).toBeNull();
  });

  it('opens on the home screen in development builds, where automated checks pick a workspace', () => {
    fakeElectron.app.isPackaged = false;
    const { windows } = setUp([mkdtempSync(join(tmpdir(), 'uvcs-last-'))]);

    windows.openFirst();
    expect(windows.takeRequested(fakeElectron.windows()[0]!.webContents.id)).toBeNull();
  });
});

describe('WorkspaceWindows', () => {
  it('cascades a new window from the focused one, else from the last opened', () => {
    const { open } = setUp();
    const first = open();
    const second = open();
    open();
    expect(vi.mocked(createMainWindow).mock.calls.map(([, options]) => options?.cascadeFrom)).toEqual([undefined, first, second]);

    first.focus();
    open();
    expect(vi.mocked(createMainWindow).mock.calls.at(-1)![1]?.cascadeFrom).toBe(first);
  });

  it('brings the app forward: the focused or last window, or a new one when all were closed', () => {
    const { windows, open } = setUp();
    open();
    const last = open();

    windows.focusAny();
    expect(fakeElectron.focused()).toBe(last);

    fakeElectron.windows().forEach((window) => window.close());
    windows.focusAny();
    expect(fakeElectron.windows()).toHaveLength(1);
  });

  it('keeps the Window menu current: windows opening, getting focus and closing', () => {
    const { open, onWindowsChanged, onClosed } = setUp();
    const window = open();
    expect(onWindowsChanged).toHaveBeenCalledTimes(1);

    window.focus();
    expect(onWindowsChanged).toHaveBeenCalledTimes(2);

    window.close();
    expect(onClosed).toHaveBeenCalledWith(window.webContents.id);
    expect(onWindowsChanged).toHaveBeenCalledTimes(3);
  });

  it('lists the open windows in the order they were opened', () => {
    const { windows, open } = setUp();
    const [a, b, c] = [open(), open(), open()];
    b.close();

    expect(windows.all()).toEqual([a, c].map(asBrowserWindow));
  });
});

describe('the windows open as the app quit', () => {
  const LEFT = { x: 0, y: 0, width: 1200, height: 800, maximized: false };
  const RIGHT = { x: 1300, y: 40, width: 1000, height: 700, maximized: true };

  /** What each window was opened with: its workspace, where it opens and whether it takes the focus. */
  const openedWith = () =>
    vi.mocked(createMainWindow).mock.calls.map(([, options]) => ({
      workspacePath: options?.workspacePath,
      reopen: options?.reopen,
      inBackground: options?.inBackground,
    }));

  it('are saved as they quit: workspace, bounds, maximized and full screen, the last focused one last', () => {
    const { windows, settings, open, shows } = setUp();
    const game = open();
    shows(game, GAME);
    game.normalBounds = { x: 0, y: 0, width: 1200, height: 800 };
    game.setFullScreen(true);
    const home = open();
    home.normalBounds = { x: 1300, y: 40, width: 1000, height: 700 };
    home.maximize();
    const tools = open();
    shows(tools, TOOLS);
    game.focus();
    // The app may quit from the Dock, no window focused: the last one that was keeps its place.
    game.minimize();

    windows.saveSession({ withViews: false });
    expect(settings.get().openWindows).toEqual([
      { workspacePath: undefined, bounds: RIGHT, fullScreen: false },
      { workspacePath: TOOLS, bounds: { x: 0, y: 0, width: 800, height: 600, maximized: false }, fullScreen: false },
      { workspacePath: GAME, bounds: LEFT, fullScreen: true },
    ]);
  });

  it('are saved on the views their pages show only for a restart to install an update', () => {
    const { windows, settings, open, shows } = setUp();
    const game = open();
    shows(game, GAME);
    windows.viewShown(game.webContents.id, 'branchExplorer');
    // A page back on the home screen keeps no view.
    const home = open();
    windows.viewShown(home.webContents.id, 'locks');

    windows.saveSession({ withViews: true });
    expect(settings.get().openWindows.map(({ workspacePath, view }) => ({ workspacePath, view }))).toEqual([
      { workspacePath: GAME, view: 'branchExplorer' },
      { workspacePath: undefined, view: undefined },
    ]);
    windows.saveSession({ withViews: false });
    expect(settings.get().openWindows.map(({ view }) => view)).toEqual([undefined, undefined]);
  });

  it('keep the view a window reopened on until its page shows another', () => {
    const game = mkdtempSync(join(tmpdir(), 'uvcs-game-'));
    const { windows, settings, shows } = setUp([], [{ workspacePath: game, bounds: LEFT, fullScreen: false, view: 'shelves' }]);
    windows.openFirst();
    const [reopened] = fakeElectron.windows();
    shows(reopened!, game);

    expect(vi.mocked(createMainWindow).mock.calls[0]?.[1]?.reopen?.view).toBe('shelves');
    windows.saveSession({ withViews: true });
    expect(settings.get().openWindows[0]?.view).toBe('shelves');
  });

  it('hear when the last window is closing, while it is still open', () => {
    const { windows, open, onLastWindowClosing } = setUp();
    const first = open();
    const last = open();

    first.close();
    expect(onLastWindowClosing).not.toHaveBeenCalled();
    last.on('close', () => expect(windows.all()).toHaveLength(1));
    last.close();
    expect(onLastWindowClosing).toHaveBeenCalledOnce();
  });

  it('are saved as none when every window was closed before quitting (macOS)', () => {
    const { windows, settings, open } = setUp();
    open().close();

    windows.saveSession({ withViews: false });
    expect(settings.get().openWindows).toEqual([]);
  });

  it('open again at launch where they were, the focused one last and in front', () => {
    const game = mkdtempSync(join(tmpdir(), 'uvcs-game-'));
    const { windows } = setUp([TOOLS], [
      { bounds: RIGHT, fullScreen: false },
      { workspacePath: game, bounds: LEFT, fullScreen: true },
    ]);

    expect(windows.firstWorkspace()).toBe(game);
    windows.openFirst();
    expect(openedWith()).toEqual([
      { workspacePath: undefined, reopen: { bounds: RIGHT, fullScreen: false }, inBackground: true },
      { workspacePath: game, reopen: { workspacePath: game, bounds: LEFT, fullScreen: true }, inBackground: false },
    ]);
  });

  it('leave out a workspace whose folder is gone, and open the last one used when none is left', () => {
    const lastUsed = mkdtempSync(join(tmpdir(), 'uvcs-last-'));
    const { windows } = setUp([lastUsed], [{ workspacePath: join(tmpdir(), 'uvcs-deleted-workspace'), bounds: LEFT, fullScreen: false }]);

    expect(windows.firstWorkspace()).toBe(lastUsed);
    windows.openFirst();
    expect(openedWith()).toEqual([{ workspacePath: lastUsed, reopen: undefined, inBackground: undefined }]);
  });

  it('open behind the workspace that launched the app, which comes forward in its own window', () => {
    const game = mkdtempSync(join(tmpdir(), 'uvcs-game-'));
    const { windows } = setUp([], [{ workspacePath: game, bounds: LEFT, fullScreen: false }]);
    windows.requestAtLaunch(TOOLS);

    expect(windows.firstWorkspace()).toBe(TOOLS);
    windows.openFirst();
    expect(openedWith()).toEqual([
      { workspacePath: game, reopen: { workspacePath: game, bounds: LEFT, fullScreen: false }, inBackground: true },
      { workspacePath: undefined, reopen: undefined, inBackground: undefined },
    ]);
    expect(windows.takeRequested(fakeElectron.windows()[1]!.webContents.id)).toBe(TOOLS);
  });

  it('are never opened again by development builds, which start on the home screen', () => {
    fakeElectron.app.isPackaged = false;
    const game = mkdtempSync(join(tmpdir(), 'uvcs-game-'));
    const { windows } = setUp([], [{ workspacePath: game, bounds: LEFT, fullScreen: false }]);

    windows.openFirst();
    expect(openedWith()).toEqual([{ workspacePath: undefined, reopen: undefined, inBackground: undefined }]);
  });
});
