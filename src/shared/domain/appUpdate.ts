/**
 * Where the app's own update stands (`main/update/AppUpdates`), the same in every window. Updates download by
 * themselves once found; `ready` waits for the user: `restart` installs on restarting, `installer` (a macOS build
 * without a Developer ID signature, which Squirrel.Mac can't install) opens the downloaded disk image to drag in.
 */
export type UpdateStatus =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'upToDate' }
  | { state: 'downloading'; version: string; percent: number }
  | { state: 'ready'; version: string; install: 'restart' | 'installer' }
  | { state: 'failed'; error: string }
  /** A development build, which has no update feed. */
  | { state: 'unavailable' };

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
