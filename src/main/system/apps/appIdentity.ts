import { posix, win32 } from 'node:path';
import type { AppFileSystem } from './appFileSystem';
import { findDesktopEntry, type DesktopEntry } from './desktopEntries';
import { findFirst } from './findProgram';
import type { InstalledApps } from './installedApps';
import type { Whereabouts } from './whereabouts';

/**
 * How each OS knows an installed app, to find it wherever it was installed (GitHub Desktop's way): its bundle
 * identifiers on macOS, its "Apps & features" entry on Windows, its desktop entry on Linux. Shared by every role an
 * app plays (an editor, a merge tool, a terminal), so each app is described once (`APP_IDENTITIES`).
 */
export interface AppIdentity {
  mac?: {
    bundleIds: string[];
    /** Its bundle's usual name, looked for in the Applications folders when Spotlight is off. */
    bundles: string[];
  };
  windows?: {
    /** Its display name starts with one of these (case aside)... */
    displayNames: string[];
    /** ...and, when given, its publisher is one of these. */
    publishers?: string[];
  };
  linux?: {
    /** `code.desktop`, the Flatpak's `com.visualstudio.code.desktop`, the Snap's `code_code.desktop`. */
    desktopIds: string[];
  };
}

/** Where an app is installed, as its OS records it. */
export type AppInstall =
  | { kind: 'macBundle'; bundle: string }
  /** Windows: its install folder, and its main program when the entry names it (`DisplayIcon`). */
  | { kind: 'windowsInstall'; folder: string; program: string }
  | { kind: 'desktopEntry'; entry: DesktopEntry };

const MAC_APP_FOLDERS = (home: string): string[] => ['/Applications', posix.join(home, 'Applications'), '/System/Applications', '/System/Applications/Utilities', '/Applications/Utilities'];

/** Where the app is installed here, or undefined when its OS has no record of it. */
export function locateInstall(identity: AppIdentity, where: Whereabouts, installed: InstalledApps, fs: AppFileSystem): AppInstall | undefined {
  if (where.platform === 'darwin' && identity.mac) {
    const bundle =
      identity.mac.bundleIds.map((id) => installed.bundles.get(id)).find(Boolean) ??
      findFirst(identity.mac.bundles.flatMap((name) => MAC_APP_FOLDERS(where.home).map((folder) => posix.join(folder, name))), where, fs);
    return bundle ? { kind: 'macBundle', bundle } : undefined;
  }
  if (where.platform === 'win32' && identity.windows) {
    return windowsInstalls(identity.windows, installed)[0];
  }
  if (where.platform === 'linux' && identity.linux) {
    const entry = findDesktopEntry(identity.linux.desktopIds, where, fs);
    return entry ? { kind: 'desktopEntry', entry } : undefined;
  }
  return undefined;
}

/** Every matching entry, in the order the keys were read (the user's first): an app can be installed twice. */
export function windowsInstalls(identity: NonNullable<AppIdentity['windows']>, installed: InstalledApps): Extract<AppInstall, { kind: 'windowsInstall' }>[] {
  const prefixes = identity.displayNames.map((name) => name.toLowerCase());
  return installed.uninstall
    .filter((entry) => prefixes.some((prefix) => entry.displayName.toLowerCase().startsWith(prefix)))
    .filter((entry) => !identity.publishers || identity.publishers.includes(entry.publisher))
    .map((entry) => {
      const program = /\.exe$/i.test(entry.displayIcon) ? entry.displayIcon : '';
      return { kind: 'windowsInstall' as const, folder: entry.installLocation || (program && win32.dirname(program)), program };
    })
    .filter((install) => install.folder);
}

/**
 * A program inside the install, the first of `relativePaths` that exists: VS Code's `bin/code` in its bundle, Rider's
 * `bin\rider64.exe` in its folder. Of several Windows installs, the first holding one.
 */
export function programInInstall(identity: AppIdentity, relativePaths: string[], where: Whereabouts, installed: InstalledApps, fs: AppFileSystem): string | undefined {
  if (relativePaths.length === 0) return undefined;
  if (where.platform === 'win32' && identity.windows) {
    const candidates = windowsInstalls(identity.windows, installed).flatMap((install) => relativePaths.map((path) => win32.join(install.folder, path)));
    return candidates.find((candidate) => fs.exists(candidate));
  }
  const install = locateInstall(identity, where, installed, fs);
  if (install?.kind !== 'macBundle') return undefined;
  return relativePaths.map((path) => posix.join(install.bundle, path)).find((candidate) => fs.exists(candidate));
}
