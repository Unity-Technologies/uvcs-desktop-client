import { join } from 'node:path';
import { LINK_SCHEME } from '@shared/links/formatLink';
import { LINK_SWITCH } from './linkArgument';
import { linuxDesktopEntry, mayWriteDesktopEntry } from './linuxDesktopEntry';

/** What registering the scheme needs from the OS, handed in so each OS's way is tested on any. */
export interface SchemeRegistrar {
  platform: NodeJS.Platform;
  env: NodeJS.ProcessEnv;
  execPath: string;
  homeDirectory: string;
  productName: string;
  /** A text file's content, or null when there is none. */
  readText(path: string): Promise<string | null>;
  /** Writes a text file, making its folder if needed. */
  writeText(path: string, text: string): Promise<void>;
  /** Electron's `app.setAsDefaultProtocolClient`. */
  setAsDefaultProtocolClient(protocol: string, path?: string, args?: string[]): boolean;
}

/**
 * Makes this installed app the one that opens `uvcs://` links (docs/features/deep-links.md, "Registering the scheme"),
 * at every packaged launch, so the scheme comes back if another app took it. The installers declare it too; this is
 * what repairs it.
 * - Windows: the same command the installer writes (`"<exe>" --uvcs-link -- "%1"`), under the user's classes.
 * - macOS: Info.plist declares it; LaunchServices makes this copy of the app its handler.
 * - Linux: only an AppImage (`APPIMAGE`), which registers nothing itself: the app writes its own desktop entry
 *   (`linuxDesktopEntry`, named as Electron names the app: `CHROME_DESKTOP`) and makes it the scheme's handler
 *   (Electron runs `xdg-settings`, which holds the main process a moment: only when the entry was written, the first
 *   launch or after the AppImage moved). A package's own entry declares the scheme itself.
 */
export async function registerLinkScheme(os: SchemeRegistrar): Promise<void> {
  if (os.platform === 'win32') {
    os.setAsDefaultProtocolClient(LINK_SCHEME, os.execPath, [LINK_SWITCH, '--']);
  } else if (os.platform === 'darwin') {
    os.setAsDefaultProtocolClient(LINK_SCHEME);
  } else if (await writeLinuxDesktopEntry(os)) {
    os.setAsDefaultProtocolClient(LINK_SCHEME);
  }
}

/** Writes the AppImage's desktop entry where the desktop finds it; whether it wrote it (it was missing or out of date). */
async function writeLinuxDesktopEntry(os: SchemeRegistrar): Promise<boolean> {
  const appImage = os.env.APPIMAGE;
  const desktopName = os.env.CHROME_DESKTOP;
  if (!appImage || !desktopName) return false;
  const dataHome = os.env.XDG_DATA_HOME || join(os.homeDirectory, '.local', 'share');
  const path = join(dataHome, 'applications', desktopName);
  const entry = linuxDesktopEntry(appImage, os.productName);
  const existing = await os.readText(path);
  if (existing === entry || !mayWriteDesktopEntry(existing)) return false;
  await os.writeText(path, entry);
  return true;
}
