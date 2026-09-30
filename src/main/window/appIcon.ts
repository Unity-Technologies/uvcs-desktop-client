// Made by scripts/icons/makeAppIcons.mjs. `?asset` has electron-vite copy each file into out/, which the app ships.
import windowIconFile from '../../../build/icons/512x512.png?asset';
import developmentDockIconFile from '../../../build/icon-macOS.png?asset';

/**
 * The icon a window shows in the taskbar, where the OS takes it from the window: always on Linux, and on Windows while
 * unpackaged. An installed Windows app shows its executable's icon (build/icon.ico, every size from 16 pixels), which a
 * single PNG would replace; macOS windows have no icon of their own.
 */
export function windowIcon(platform: string, packaged: boolean): string | undefined {
  if (platform === 'linux' || (platform === 'win32' && !packaged)) return windowIconFile;
  return undefined;
}

/**
 * The Dock's icon while the app runs unpackaged (`npm run dev`, `npm start`), which would otherwise be Electron's; an
 * installed app's comes from its bundle (build/icon.icns).
 */
export const DEVELOPMENT_DOCK_ICON = developmentDockIconFile;
