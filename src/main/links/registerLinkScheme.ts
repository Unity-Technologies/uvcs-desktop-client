import { join } from 'node:path';
import { LINK_SCHEME } from '@shared/links/formatLink';
import { LINK_SWITCH } from './linkArgument';
import { linkHandlerDesktopId, linuxDesktopEntry, mayWriteDesktopEntry } from './linuxDesktopEntry';

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
  removeFile(path: string): Promise<void>;
  /** Electron's `app.setAsDefaultProtocolClient` (Windows, macOS). */
  setAsDefaultProtocolClient(protocol: string, path?: string, args?: string[]): boolean;
  /** Makes a desktop entry the scheme's handler on Linux (`setDefaultLinkHandler`). */
  setDefaultLinkHandler(desktopId: string): Promise<void>;
}

/**
 * Makes this installed app the one that opens `uvcs://` links (docs/features/deep-links.md, "Registering the scheme"),
 * at every packaged launch, so the scheme comes back if another app took it. The installers declare it too; this is
 * what repairs it.
 * - Windows: the same command the installer writes (`"<exe>" --uvcs-link -- "%1"`), under the user's classes.
 * - macOS: Info.plist declares it; LaunchServices makes this copy of the app its handler.
 * - Linux: only an AppImage (`APPIMAGE`), which registers nothing itself: the app writes a desktop entry of its own
 *   for links (`linuxDesktopEntry`, under `linkHandlerDesktopId`, never the app's own id, which the launcher matches
 *   the app's windows by) and makes it the scheme's handler (`xdg-mime`), when the entry was missing or out of date
 *   (the first launch, or after the AppImage moved). A package's own entry declares the scheme itself.
 */
export async function registerLinkScheme(os: SchemeRegistrar): Promise<void> {
  if (os.platform === 'win32') {
    os.setAsDefaultProtocolClient(LINK_SCHEME, os.execPath, [LINK_SWITCH, '--']);
  } else if (os.platform === 'darwin') {
    os.setAsDefaultProtocolClient(LINK_SCHEME);
  } else if (await writeLinuxDesktopEntry(os)) {
    await os.setDefaultLinkHandler(linkHandlerDesktopId(os.env.CHROME_DESKTOP!));
  }
}

/**
 * Writes the AppImage's link handler entry where the desktop finds it, and removes the one an earlier version wrote
 * under the app's own id; whether it wrote it (it was missing or out of date).
 */
async function writeLinuxDesktopEntry(os: SchemeRegistrar): Promise<boolean> {
  const appImage = os.env.APPIMAGE;
  const appDesktopId = os.env.CHROME_DESKTOP;
  if (!appImage || !appDesktopId) return false;
  const applications = join(os.env.XDG_DATA_HOME || join(os.homeDirectory, '.local', 'share'), 'applications');
  await removeOwnEntry(os, join(applications, appDesktopId));
  const path = join(applications, linkHandlerDesktopId(appDesktopId));
  const entry = linuxDesktopEntry(appImage, os.productName);
  const existing = await os.readText(path);
  if (existing === entry || !mayWriteDesktopEntry(existing)) return false;
  await os.writeText(path, entry);
  return true;
}

/** Removes an entry the app wrote itself (its marker), never one a package or another tool did. */
async function removeOwnEntry(os: SchemeRegistrar, path: string): Promise<void> {
  const existing = await os.readText(path);
  if (existing !== null && mayWriteDesktopEntry(existing)) await os.removeFile(path);
}
