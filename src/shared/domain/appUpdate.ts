/**
 * Where the app's own update stands (`main/update/AppUpdates`), the same in every window. Updates download by
 * themselves once found; `ready` waits for the user: `restart` installs on restarting, `installer` (a macOS build
 * without a Developer ID signature, which Squirrel.Mac can't install) opens the downloaded disk image to drag in.
 * Either quits the app, so it waits for an operation changing a workspace to finish (`waitingToInstall`).
 */
export type UpdateStatus =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'upToDate' }
  | { state: 'downloading'; version: string; percent: number; installedCm?: InstalledCmUpdate }
  | { state: 'ready'; version: string; install: 'restart' | 'installer'; installedCm?: InstalledCmUpdate }
  /**
   * The user asked to install, and it waits: for an operation changing a workspace to finish (`operation`), or for the
   * installed Unity Version Control's installer, run first (`installedCm`).
   */
  | { state: 'waitingToInstall'; version: string; install: 'restart' | 'installer'; waitingFor: 'operation' | 'installedCm'; installedCm?: InstalledCmUpdate }
  | { state: 'failed'; error: string }
  /** A development build, which has no update feed. */
  | { state: 'unavailable' };

/**
 * The installed Unity Version Control, which runs, is older than the update needs (docs/features/cm-runtime.md "Updates
 * bring their cm"): its installer downloads with the update and runs before the restart (`installer`), or, on Linux,
 * the user updates it with a command after the restart (`command`).
 */
export interface InstalledCmUpdate {
  installedVersion: string;
  /** The `cm` version the update pins: the oldest it runs. */
  neededVersion: string;
  by: 'installer' | 'command';
}

/**
 * What changed in one release: its notes on GitHub, as GitHub renders them (HTML, from the releases feed that
 * electron-updater reads anyway). The renderer reads them into elements (`releaseNotesOutline`), never as HTML.
 */
export interface ReleaseNotes {
  version: string;
  html: string;
  /**
   * When the release was made (ISO 8601), the update's own release only: the feed dates just the update it found
   * (its `latest*.yml`), not the releases it skips.
   */
  releaseDate?: string;
}

/** What the About dialog shows of the running app. */
export interface AppInfo {
  version: string;
  electron: string;
  chromium: string;
  platform: string;
  arch: string;
  documentationUrl: string;
  /** Where to report a problem. */
  issuesUrl: string;
  /** Every release with its notes (What's New's "All releases"). */
  releasesUrl: string;
}
