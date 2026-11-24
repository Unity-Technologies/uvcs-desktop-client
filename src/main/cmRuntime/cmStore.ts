import { posix, win32 } from 'node:path';
import { compareCmVersions } from '@shared/domain/cmRuntime';

/**
 * The folder where the app keeps its `cm`, one subfolder per version (docs/features/cm-runtime.md "The store"). On
 * Windows and Linux not the user data folder: on Windows that one roams with the user's profile, and 260 MB has no
 * place there; on Linux it is ~/.config, for settings. On macOS it is inside it, where apps keep what they need. Never
 * a cache folder: the OS may empty those, and the app couldn't start offline.
 *
 * - Windows: `%LOCALAPPDATA%\Unity Version Control\cm`
 * - macOS:   `~/Library/Application Support/Unity Version Control/cm`
 * - Linux:   `$XDG_DATA_HOME/unity-version-control/cm` (`~/.local/share` when it isn't set)
 */
export function cmStoreFolder(platform: NodeJS.Platform, env: NodeJS.ProcessEnv, home: string): string {
  if (platform === 'win32') return win32.join(env.LOCALAPPDATA || win32.join(home, 'AppData', 'Local'), 'Unity Version Control', 'cm');
  if (platform === 'darwin') return posix.join(home, 'Library', 'Application Support', 'Unity Version Control', 'cm');
  return posix.join(env.XDG_DATA_HOME || posix.join(home, '.local', 'share'), 'unity-version-control', 'cm');
}

/** What the store holds for one version, by name: the folder `cm` runs from, and the two that only exist on the way to it. */
export interface CmStoreEntries {
  /** `<version>`: the unpacked bundle, checked; `cm` is in its `client` folder. */
  installed: string;
  /** `<version>.partial`: the bundle as far as it downloaded, which the next attempt resumes. */
  partial: string;
  /** `<version>.unpacking`: the bundle being unpacked, renamed to the installed folder once checked. */
  unpacking: string;
}

function joinFor(platform: NodeJS.Platform): (...parts: string[]) => string {
  return platform === 'win32' ? win32.join : posix.join;
}

export function cmStoreEntries(store: string, version: string, platform: NodeJS.Platform): CmStoreEntries {
  const join = joinFor(platform);
  return { installed: join(store, version), partial: join(store, `${version}.partial`), unpacking: join(store, `${version}.unpacking`) };
}

/** The `cm` of an installed version. Every bundle unpacks into `client/`. */
export function managedCmPath(store: string, version: string, platform: NodeJS.Platform): string {
  return joinFor(platform)(store, version, 'client', platform === 'win32' ? 'cm.exe' : 'cm');
}

/** The version an entry of the store belongs to: `11.0.16.10659.partial` → `11.0.16.10659`. */
function versionOfEntry(name: string): string {
  return name.replace(/\.(partial|unpacking)$/, '');
}

/**
 * The entries of the store to delete: every version but the pinned one and the newest above it (one an update
 * downloaded to run, kept across restarts until it starts: docs/features/cm-runtime.md "Updates bring their cm"),
 * finished or not; every version when `pinned` is null, as the installed `cm` runs. Anything else in the folder is left
 * alone.
 */
export function storeEntriesToPrune(names: readonly string[], pinned: string | null): string[] {
  if (pinned === null) return names.filter((name) => VERSION_ENTRY.test(name)).sort();
  const versions = names.filter((name) => VERSION_ENTRY.test(name)).map(versionOfEntry);
  const newer = versions.filter((version) => compareCmVersions(version, pinned) > 0).sort(compareCmVersions);
  const keep = [pinned, ...newer.slice(-1)];
  return names.filter((name) => VERSION_ENTRY.test(name) && !keep.includes(versionOfEntry(name))).sort();
}

const VERSION_ENTRY = /^\d+\.\d+\.\d+\.\d+(\.partial|\.unpacking)?$/;
