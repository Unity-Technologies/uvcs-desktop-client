import { app, BrowserWindow } from 'electron';
import { AppIconProgress } from './AppIconProgress';

/**
 * The app's icon showing the operations that change a workspace (`AppIconProgress`), drawn through each window's
 * `setProgressBar`, and told about every window as it opens, comes forward and closes.
 */
export function showProgressOnAppIcon(platform: NodeJS.Platform = process.platform): AppIconProgress {
  const icon = new AppIconProgress(
    {
      ids: () => BrowserWindow.getAllWindows().filter((window) => !window.isDestroyed()).map((window) => window.id),
      isFocused: (windowId) => BrowserWindow.fromId(windowId)?.isFocused() ?? false,
      setProgressBar: (windowId, { value, mode }) => BrowserWindow.fromId(windowId)?.setProgressBar(value, mode ? { mode } : undefined),
    },
    platform,
  );
  app.on('browser-window-created', (_event, window) => {
    const windowId = window.id;
    window.on('focus', () => icon.windowFocused(windowId));
    window.on('close', () => icon.windowClosing(windowId));
    // The page held the close back (unsaved edits, `askBeforeUnloading`): the window may stay.
    window.webContents.on('will-prevent-unload', () => icon.windowKept(windowId));
    window.on('closed', () => icon.windowClosed(windowId));
    icon.windowOpened();
  });
  return icon;
}
