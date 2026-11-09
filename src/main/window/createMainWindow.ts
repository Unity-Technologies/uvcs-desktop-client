import { join } from 'node:path';
import { app, BrowserWindow, nativeTheme, shell, type Event } from 'electron';
import type { Place } from '@shared/domain/place';
import type { PageSeed, PageWindowPage } from '@shared/domain/pageWindow';
import type { SavedWindow } from '@shared/domain/settings';
import { pageWindowQuery, startingPlaceQuery } from '@shared/startingPlace';
import { WINDOW_BACKGROUND, windowChrome } from '@shared/windowChrome';
import { sendEventTo } from '../ipc/sendEvent';
import type { SettingsStore } from '../settings/SettingsStore';
import { isWebAddress } from '../system/webAddress';
import { windowIcon } from './appIcon';
import { cascadedWindowBounds, keepWindowBoundsSaved, loadWindowBounds, reopenedWindowBounds, type SavedBoundsKey } from './savedWindowBounds';
import { fitWindowControls, followPageZoom } from './pageZoom';
import { titleBarOptions } from './titleBar';
import { MIN_WINDOW_HEIGHT, MIN_WINDOW_WIDTH } from './windowBounds';

/** Until the user leaves a window somewhere (`loadWindowBounds`). */
const DEFAULT_SIZE = { width: 1400, height: 900 };

interface MainWindowOptions {
  /** The window it was opened from: it opens a little below and to the right, so it doesn't hide that one. */
  cascadeFrom?: BrowserWindow;
  /**
   * The place its page starts on (`startingPlaceQuery`): a workspace whose folder is known to be there, or a repository
   * explored without one; the home screen without one.
   */
  place?: Place;
  /** A window open when the app last quit: it opens where it was, full screen if it was. */
  reopen?: SavedWindow;
  /** Shows without taking the focus: a window reopened at launch behind the one that had it. */
  inBackground?: boolean;
  /**
   * A page window's page (`windows.openPage`), shown in `place`. Without `cascadeFrom`, it opens where the last
   * page window was left (`pageWindowBounds`: on the other display, say), and its bounds are saved apart from the
   * workspace windows'.
   */
  page?: PageWindowPage;
  /** What the page shows, already read where it opened (`PageSeed`). */
  seed?: PageSeed;
  /** The window was asked to close; the first `close` listener, which may hold it back (`WorkspaceWindows`' `onCloseRequested`). */
  onCloseRequested?: (windowId: number, event: Event) => void;
}

/**
 * Opens a window where it was when the app quit, or where the last one was (both fitted to the current displays), or
 * cascaded from another one. The page title becomes the window title.
 */
export function createMainWindow(
  settings: SettingsStore,
  { cascadeFrom, place, reopen, inBackground, page, seed, onCloseRequested }: MainWindowOptions = {},
): BrowserWindow {
  const boundsKey = page ? 'pageWindowBounds' : 'windowBounds';
  const { bounds, maximized } = openingBounds(settings, { cascadeFrom, reopen }, boundsKey);
  const chrome = windowChrome(process.platform);
  const window = new BrowserWindow({
    ...DEFAULT_SIZE,
    ...bounds,
    minWidth: MIN_WINDOW_WIDTH,
    minHeight: MIN_WINDOW_HEIGHT,
    show: false,
    title: 'Unity Version Control',
    icon: windowIcon(process.platform, app.isPackaged),
    ...titleBarOptions(chrome, nativeTheme.shouldUseDarkColors),
    backgroundColor: WINDOW_BACKGROUND[nativeTheme.shouldUseDarkColors ? 'dark' : 'light'],
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: true,
    },
  });

  // First: every other `close` listener (the bounds saved, `askBeforeUnloading`, the last window's) sees whether it was held back.
  if (onCloseRequested) window.on('close', (event) => onCloseRequested(window.id, event));
  keepWindowBoundsSaved(window, settings, boundsKey);
  followPageZoom(window, chrome);
  window.once('ready-to-show', () => {
    // The page has its zoom by now: the window shows with its controls where the zoomed top bar puts them.
    fitWindowControls(window, chrome);
    // Maximizing also shows the window, so it waits until the page can paint.
    if (maximized) window.maximize();
    if (inBackground) window.showInactive();
    else window.show();
    if (reopen?.fullScreen) window.setFullScreen(true);
  });
  // Windows only: a mouse's back button and a keyboard's Browser Back key come as app commands (elsewhere as mouse buttons).
  window.on('app-command', (_event, command) => {
    if (command === 'browser-backward') sendEventTo(window.webContents, 'navigateBack', {});
  });
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (isWebAddress(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });

  loadPage(window, page && place ? pageWindowQuery(place, page, seed) : startingPlaceQuery(place, reopen?.view));
  return window;
}

function openingBounds(settings: SettingsStore, { cascadeFrom, reopen }: Pick<MainWindowOptions, 'cascadeFrom' | 'reopen'>, key: SavedBoundsKey) {
  if (reopen) return reopenedWindowBounds(reopen.bounds);
  return cascadeFrom ? cascadedWindowBounds(cascadeFrom) : loadWindowBounds(settings, key);
}

/** The development server's page while `npm run dev` serves it (hot reload), else the built one. */
function loadPage(window: BrowserWindow, query: Record<string, string>): void {
  if (process.env.ELECTRON_RENDERER_URL) void window.loadURL(`${process.env.ELECTRON_RENDERER_URL}?${new URLSearchParams(query)}`);
  else void window.loadFile(join(__dirname, '../renderer/index.html'), { query });
}
