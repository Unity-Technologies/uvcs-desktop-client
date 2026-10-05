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
  | { state: 'downloading'; version: string; percent: number }
  | { state: 'ready'; version: string; install: 'restart' | 'installer' }
  /** The user asked to install while an operation changes a workspace: it installs once that finishes. */
  | { state: 'waitingToInstall'; version: string; install: 'restart' | 'installer' }
  | { state: 'failed'; error: string }
  /** A development build, which has no update feed. */
  | { state: 'unavailable' };

/**
 * What changed in one release: its notes on GitHub, as GitHub renders them (HTML, from the releases feed that
 * electron-updater reads anyway). The renderer reads them into elements (`releaseNotesFromHtml`), never as HTML.
 */
export interface ReleaseNotes {
  version: string;
  html: string;
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
}
