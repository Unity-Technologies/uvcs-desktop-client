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

describe('a link opened in a workspace (docs/features/deep-links.md)', () => {
  const LINK = 'uvcs://acme.unity/repos/game/changesets/12';
  const SERVER_LINK = 'uvcs://acme.unity/projects/Racing';

  it('goes to the window showing the workspace, which is told, comes forward and takes it once', () => {
    const { windows, open, shows } = setUp();
    const game = open();
    shows(game, GAME);
    const tools = open();
    shows(tools, TOOLS);

    expect(windows.openLinkIn(tools.webContents.id, GAME, LINK)).toBe('handedOver');
    expect(fakeElectron.focused()).toBe(game);
    expect(game.webContents.sent).toEqual([[EVENT_CHANNEL, 'linkRequested', {}]]);
    expect(windows.takeLink(game.webContents.id)).toBe(LINK);
    expect(windows.takeLink(game.webContents.id)).toBeNull();
  });

  it('is opened by the window asking when it shows the home screen', () => {
    const { windows, open } = setUp();
    const home = open();

    expect(windows.openLinkIn(home.webContents.id, GAME, LINK)).toBe('openHere');
    expect(fakeElectron.windows()).toHaveLength(1);
  });

  it('opens a new window on the workspace, which takes it, rather than leave the workspace the asking window shows', () => {
    const { windows, open, shows } = setUp();
    const tools = open();
    shows(tools, TOOLS);

    expect(windows.openLinkIn(tools.webContents.id, GAME, LINK)).toBe('handedOver');
    const [, opened] = fakeElectron.windows();
    expect(windows.workspaceIn(asBrowserWindow(opened!))).toBe(GAME);
    expect(windows.takeLink(opened!.webContents.id)).toBe(LINK);
  });

  it('is opened by the window asking when a link to repositories finds it on the home screen', () => {
    const { windows, open } = setUp();
    const home = open();

    expect(windows.openLinkAtHome(home.webContents.id, SERVER_LINK)).toBe('openHere');
    expect(fakeElectron.windows()).toHaveLength(1);
  });

  it('goes to another window on the home screen rather than leave the workspace the asking window shows', () => {
    const { windows, open, shows } = setUp();
    const tools = open();
    shows(tools, TOOLS);
    const home = open();

    expect(windows.openLinkAtHome(tools.webContents.id, SERVER_LINK)).toBe('handedOver');
    expect(fakeElectron.focused()).toBe(home);
    expect(windows.takeLink(home.webContents.id)).toBe(SERVER_LINK);
    expect(windows.workspaceIn(asBrowserWindow(tools))).toBe(TOOLS);
  });

  it('opens a new window on the home screen for a link to repositories when every window shows a workspace', () => {
    const { windows, open, shows } = setUp();
    const tools = open();
    shows(tools, TOOLS);

    expect(windows.openLinkAtHome(tools.webContents.id, SERVER_LINK)).toBe('handedOver');
    const [, opened] = fakeElectron.windows();
    expect(windows.workspaceIn(asBrowserWindow(opened!))).toBeUndefined();
    expect(windows.takeLink(opened!.webContents.id)).toBe(SERVER_LINK);
  });

  it('lists the workspaces shown, the last focused window first', () => {
    const { windows, open, shows } = setUp();
    const game = open();
    shows(game, GAME);
    open();
    const tools = open();
    shows(tools, TOOLS);
    game.focus();

    expect(windows.shownWorkspaces()).toEqual([GAME, TOOLS]);
  });

  it('from the OS goes to the focused window, which takes it', () => {
    const { windows, open, shows } = setUp();
    const game = open();
    shows(game, GAME);
    const home = open();
    game.focus();

    windows.openLink(LINK);
    expect(windows.takeLink(game.webContents.id)).toBe(LINK);
    expect(windows.takeLink(home.webContents.id)).toBeNull();
  });

  it("from the OS goes to a focused page window's workspace window, which comes forward", () => {
    const { windows, open, shows } = setUp();
    const game = open();
    shows(game, GAME);
    const page = windows.openPage(game.webContents.id, { workspacePath: GAME, page: { kind: 'history', path: 'a.cs' } }) as unknown as FakeWindow;
    page.focus();

    windows.openLink(LINK);
    expect(fakeElectron.focused()).toBe(game);
    expect(windows.takeLink(game.webContents.id)).toBe(LINK);
  });

  it('from the OS goes to the window used last when none has the focus, else to a new one on the home screen', () => {
    const { windows, open } = setUp();
    const first = open();
    first.focus();
    open();
    first.minimize();

    windows.openLink(LINK);
    expect(fakeElectron.focused()).toBe(first);
    expect(windows.takeLink(first.webContents.id)).toBe(LINK);

    first.close();
    fakeElectron.windows()[0]!.close();
    windows.openLink(LINK);
    const [opened] = fakeElectron.windows();
    expect(windows.workspaceIn(asBrowserWindow(opened!))).toBeUndefined();
    expect(windows.takeLink(opened!.webContents.id)).toBe(LINK);
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

  it('tell whether a window shows the home screen: none once each shows or was asked to open a workspace', () => {
    const { windows, open, shows } = setUp();
    expect(windows.showsHomeScreen()).toBe(false);

    const home = open();
    open(TOOLS);
    expect(windows.showsHomeScreen()).toBe(true);

    shows(home, GAME);
    expect(windows.showsHomeScreen()).toBe(false);
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

describe('page windows', () => {
  const DIFF = { kind: 'diff', title: 'Changeset 7', target: { kind: 'changeset', changesetId: 7 } };
  const HISTORY = { kind: 'history', path: 'src/player.cs' };

  /** A workspace window on GAME and a page window it opened, its page showing GAME too as it watches it. */
  function withPageWindow(setup = setUp()) {
    const game = setup.open();
    setup.shows(game, GAME);
    const page = setup.windows.openPage(game.webContents.id, { workspacePath: GAME, page: DIFF }) as unknown as FakeWindow;
    setup.shows(page, GAME);
    return { ...setup, game, page };
  }

  const sentTo = (window: FakeWindow) => window.webContents.sent.map(([, name, payload]) => [name, payload]);

  it('open on the page, cascaded from their workspace window the first time, then where the last page window was', () => {
    const { windows, settings, game, page } = withPageWindow();
    expect(vi.mocked(createMainWindow).mock.calls.at(-1)?.[1]).toEqual({ cascadeFrom: game, workspacePath: GAME, page: DIFF });

    windows.openPage(game.webContents.id, { workspacePath: GAME, page: HISTORY });
    expect(vi.mocked(createMainWindow).mock.calls.at(-1)?.[1]).toMatchObject({ cascadeFrom: page, page: HISTORY });

    page.close();
    fakeElectron.windows().at(-1)!.close();
    settings.update({ pageWindowBounds: { x: 2000, y: 40, width: 900, height: 700, maximized: false } });
    windows.openPage(game.webContents.id, { workspacePath: GAME, page: DIFF });
    expect(vi.mocked(createMainWindow).mock.calls.at(-1)?.[1]).toMatchObject({ cascadeFrom: undefined, page: DIFF });
  });

  it("aren't workspace windows: opening their workspace brings its window forward, and they aren't saved for the next launch", () => {
    const { windows, settings, game, page } = withPageWindow();
    page.focus();

    expect(windows.all()).toEqual([game]);
    expect(windows.windowShowing(GAME)).toBe(game);
    windows.showWorkspace(GAME);
    expect(fakeElectron.focused()).toBe(game);
    windows.saveSession({ withViews: false });
    expect(settings.get().openWindows.map(({ workspacePath }) => workspacePath)).toEqual([GAME]);
  });

  it('belong to the workspace window, also when a page window opens another', () => {
    const { windows, game, page } = withPageWindow();

    const another = windows.openPage(page.webContents.id, { workspacePath: GAME, page: HISTORY }) as unknown as FakeWindow;
    expect(windows.pageWindowsOf(game.webContents.id)).toEqual([page, another]);
    expect(windows.ownerOf(another.webContents.id)).toBe(game.webContents.id);
  });

  it('close with their workspace window, telling the watchers they show nothing anymore', () => {
    const { game, page, onClosed } = withPageWindow();

    game.close();
    expect(page.isDestroyed()).toBe(true);
    expect(onClosed).toHaveBeenCalledWith(page.webContents.id);
  });

  it('close once their workspace window shows another workspace or the home screen, and stay while it shows theirs', () => {
    const { windows, game, page } = withPageWindow();

    windows.workspaceShown(game.webContents.id, GAME);
    expect(page.isDestroyed()).toBe(false);
    windows.workspaceShown(game.webContents.id, TOOLS);
    expect(page.isDestroyed()).toBe(true);

    const other = withPageWindow();
    other.windows.workspaceShown(other.game.webContents.id, undefined);
    expect(other.page.isDestroyed()).toBe(true);
  });

  it("follow their workspace window's selection: both hear it, and the page window gets each selection", () => {
    const { windows, game, page } = withPageWindow();

    windows.selectionShown(game.webContents.id, HISTORY);
    expect(sentTo(page)).toEqual([]);

    windows.follow(page.webContents.id, true);
    windows.selectionShown(game.webContents.id, DIFF);
    expect(sentTo(page)).toEqual([
      ['followingChanged', { following: true }],
      ['selectionToFollow', { page: DIFF }],
    ]);
    expect(sentTo(game)).toEqual([['selectionFollowed', { followed: true }]]);

    page.close();
    expect(sentTo(game).at(-1)).toEqual(['selectionFollowed', { followed: false }]);
  });

  it("log their commands in their workspace window's command log", () => {
    const { windows, game, page } = withPageWindow();

    expect(windows.commandLogOf(page.webContents as never)).toBe(game.webContents);
    expect(windows.commandLogOf(game.webContents as never)).toBe(game.webContents);
  });

  it('tell a page loaded again whether it follows or is followed, as it starts not knowing', () => {
    const { windows, game, page } = withPageWindow();
    page.webContents.emit('did-finish-load');
    game.webContents.emit('did-finish-load');
    expect([...sentTo(page), ...sentTo(game)]).toEqual([]);

    windows.follow(page.webContents.id, true);
    page.webContents.sent.length = 0;
    game.webContents.sent.length = 0;
    page.webContents.emit('did-finish-load');
    game.webContents.emit('did-finish-load');
    expect(sentTo(page)).toEqual([['followingChanged', { following: true }]]);
    expect(sentTo(game)).toEqual([['selectionFollowed', { followed: true }]]);
  });

  it('open a page only their workspace window shows (a merge) there, bringing it forward', () => {
    const { windows, game, page } = withPageWindow();
    const merge = { kind: 'merge', request: { kind: 'merge', sourceSpec: 'cs:7' } };
    page.focus();

    windows.openInWorkspaceWindow(page.webContents.id, merge);
    expect(fakeElectron.focused()).toBe(game);
    expect(sentTo(game)).toEqual([['pageRequested', { page: merge }]]);
  });

  it('bring their workspace window forward, running a command there when asked', () => {
    const { windows, game, page } = withPageWindow();
    page.focus();

    windows.showWorkspaceWindow(page.webContents.id, 'goto.branches');
    expect(fakeElectron.focused()).toBe(game);
    expect(sentTo(game)).toEqual([['menuCommand', { commandId: 'goto.branches' }]]);
  });
});
