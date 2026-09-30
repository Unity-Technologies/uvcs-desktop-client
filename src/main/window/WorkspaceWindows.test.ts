import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BrowserWindow } from 'electron';
import { EVENT_CHANNEL } from '@shared/ipc';
import { memorySettings } from '../testing/scriptedCm';
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
  vi.mocked(createMainWindow).mockClear();
});

/** The windows, with each page saying which workspace it shows (`shows`). */
function setUp(recentWorkspacePaths: string[] = []) {
  const shown = new Map<number, string>();
  const onWindowsChanged = vi.fn();
  const onClosed = vi.fn();
  const windows = new WorkspaceWindows({
    settings: memorySettings({ recentWorkspacePaths }),
    workspaceOf: (viewer) => shown.get(viewer),
    onWindowsChanged,
    onClosed,
  });
  const open = (workspacePath?: string): FakeWindow => windows.open(workspacePath) as unknown as FakeWindow;
  /** The page of `window` now shows `workspacePath` (after taking its request, or picked on the home screen). */
  const shows = (window: FakeWindow, workspacePath: string): void => void shown.set(window.webContents.id, workspacePath);
  return { windows, open, shows, onWindowsChanged, onClosed };
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

    windows.requestWorkspace(GAME, true);
    expect(fakeElectron.windows()).toHaveLength(2);
    expect(fakeElectron.focused()).toBe(home);
    expect(home.webContents.sent).toEqual([[EVENT_CHANNEL, 'workspaceOpenRequested', {}]]);
    expect(windows.takeRequested(home.webContents.id)).toBe(GAME);
  });

  it('opens a new window when every window shows another workspace', () => {
    const { windows, open, shows } = setUp();
    shows(open(), TOOLS);

    windows.requestWorkspace(GAME, true);
    expect(fakeElectron.windows()).toHaveLength(2);
  });

  it('brings forward the window already showing it', () => {
    const { windows, open, shows } = setUp();
    const game = open();
    shows(game, GAME);
    open();

    windows.requestWorkspace(GAME, true);
    expect(fakeElectron.windows()).toHaveLength(2);
    expect(fakeElectron.focused()).toBe(game);
  });

  it('opens in the first window when it launched the app, once', () => {
    const { windows } = setUp();

    windows.requestWorkspace(GAME, false);
    expect(fakeElectron.windows()).toEqual([]);
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

  it('opens on the home screen when the last workspace used is gone', () => {
    const { windows } = setUp([join(tmpdir(), 'uvcs-deleted-workspace')]);

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
    expect(vi.mocked(createMainWindow).mock.calls.map(([, cascadeFrom]) => cascadeFrom)).toEqual([undefined, first, second]);

    first.focus();
    open();
    expect(vi.mocked(createMainWindow).mock.calls.at(-1)![1]).toBe(first);
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
