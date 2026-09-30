import { join } from 'node:path';
import { app, BrowserWindow, nativeTheme, shell } from 'electron';
import { startingWorkspaceQuery } from '@shared/startingWorkspace';
import { WINDOW_BACKGROUND, windowChrome } from '@shared/windowChrome';
import { sendEventTo } from '../ipc/sendEvent';
import type { SettingsStore } from '../settings/SettingsStore';
import { windowIcon } from './appIcon';
import { cascadedWindowBounds, loadWindowBounds, keepWindowBoundsSaved } from './savedWindowBounds';
import { titleBarOptions } from './titleBar';
import { MIN_WINDOW_HEIGHT, MIN_WINDOW_WIDTH } from './windowBounds';

/** Until the user leaves a window somewhere (`loadWindowBounds`). */
const DEFAULT_SIZE = { width: 1400, height: 900 };

interface MainWindowOptions {
  /** The window it was opened from: it opens a little below and to the right, so it doesn't hide that one. */
  cascadeFrom?: BrowserWindow;
  /** The workspace its page starts on (`startingWorkspaceQuery`), its folder known to be there; the home screen without one. */
  workspacePath?: string;
}

/**
 * Opens a window where the last one was (fitted to the current displays), or cascaded from another one. The page title
 * becomes the window title.
 */
export function createMainWindow(settings: SettingsStore, { cascadeFrom, workspacePath }: MainWindowOptions = {}): BrowserWindow {
  const { bounds, maximized } = cascadeFrom ? cascadedWindowBounds(cascadeFrom) : loadWindowBounds(settings);
  const window = new BrowserWindow({
    ...DEFAULT_SIZE,
    ...bounds,
    minWidth: MIN_WINDOW_WIDTH,
    minHeight: MIN_WINDOW_HEIGHT,
    show: false,
    title: 'Unity Version Control',
    icon: windowIcon(process.platform, app.isPackaged),
    ...titleBarOptions(windowChrome(process.platform), nativeTheme.shouldUseDarkColors),
    backgroundColor: WINDOW_BACKGROUND[nativeTheme.shouldUseDarkColors ? 'dark' : 'light'],
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: true,
    },
  });

  keepWindowBoundsSaved(window, settings);
  window.once('ready-to-show', () => {
    // Maximizing also shows the window, so it waits until the page can paint.
    if (maximized) window.maximize();
    window.show();
  });
  // Windows only: a mouse's back button and a keyboard's Browser Back key come as app commands (elsewhere as mouse buttons).
  window.on('app-command', (_event, command) => {
    if (command === 'browser-backward') sendEventTo(window.webContents, 'navigateBack', {});
  });
  window.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  loadPage(window, startingWorkspaceQuery(workspacePath));
  return window;
}

/** The development server's page while `npm run dev` serves it (hot reload), else the built one. */
function loadPage(window: BrowserWindow, query: Record<string, string>): void {
  if (process.env.ELECTRON_RENDERER_URL) void window.loadURL(`${process.env.ELECTRON_RENDERER_URL}?${new URLSearchParams(query)}`);
  else void window.loadFile(join(__dirname, '../renderer/index.html'), { query });
}
