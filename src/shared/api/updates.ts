import type { AppInfo, ReleaseNotes, UpdateStatus } from '../domain/appUpdate';

/** The app itself: what it runs on, and its updates (the status changes arrive as `updateStatusChanged`). */
export interface UpdatesApi {
  appInfo(): Promise<AppInfo>;
  /** Where the update stands now, for a window that just opened. */
  status(): Promise<UpdateStatus>;
  /** Looks for an update now; one found downloads by itself. */
  check(): Promise<void>;
  /** The notes of every release between the running version and the update found, newest first; none before one is found. */
  releaseNotes(): Promise<ReleaseNotes[]>;
  /** Installs the downloaded update: restarts into it, or opens its installer and quits (`install: 'installer'`). */
  install(): Promise<void>;
}
