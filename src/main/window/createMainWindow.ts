import { join } from 'node:path';
import { BrowserWindow, nativeTheme, shell } from 'electron';
import type { SettingsStore } from '../settings/SettingsStore';
import { loadWindowBounds, saveWindowBounds } from './savedWindowBounds';
import { MIN_WINDOW_HEIGHT, MIN_WINDOW_WIDTH } from './windowBounds';

const DARK_BACKGROUND = '#16171b';
const LIGHT_BACKGROUND = '#ffffff';

/** Opens the main window where it was last (fitted to the current displays). The page title becomes the window title. */
export function createMainWindow(settings: SettingsStore): BrowserWindow {
  const { bounds, maximized } = loadWindowBounds(settings);
  const window = new BrowserWindow({
    width: 1400,
    height: 900,
    ...bounds,
    minWidth: MIN_WINDOW_WIDTH,
    minHeight: MIN_WINDOW_HEIGHT,
    show: false,
    title: 'Unity Version Control',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: { x: 16, y: 16 },
    backgroundColor: nativeTheme.shouldUseDarkColors ? DARK_BACKGROUND : LIGHT_BACKGROUND,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: true,
    },
  });

  saveWindowBounds(window, settings);
  window.once('ready-to-show', () => {
    // Maximizing also shows the window, so it waits until the page can paint.
    if (maximized) window.maximize();
    window.show();
  });
  window.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    void window.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'));
  }
  return window;
}
