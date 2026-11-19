import type { ReleaseNotes, UpdateStatus } from '@shared/domain/appUpdate';
import type { CmPrefetch } from '../cmRuntime/CmRuntime';
import type { ReleaseFile } from './installerAsset';
import { releaseNotesOf, type FeedReleaseNotes } from './releaseNotes';
import { describeUpdateError, UpdateFailure, updateErrorForLog } from './updateError';

/** Waits this long after launch before the first check, so it never competes with the first window's reads. */
export const FIRST_CHECK_DELAY_MS = 4000;
/** Checks again this often while the app stays open, so a long session still hears of a release the same day. */
export const CHECK_INTERVAL_MS = 60 * 60 * 1000;

/** What `AppUpdates` uses of electron-updater's `autoUpdater`. */
export interface UpdateFeed {
  checkForUpdates(): Promise<{ isUpdateAvailable: boolean; updateInfo: FoundUpdate } | null>;
  downloadUpdate(): Promise<unknown>;
  quitAndInstall(isSilent: boolean, isForceRunAfter: boolean): void;
  on(event: 'download-progress', listener: (progress: { percent: number }) => void): unknown;
}

/** The share of an update's progress its own download takes when its `cm` downloads too. */
export const APP_SHARE_WITH_CM = 0.5;

/** What `AppUpdates` reads of the update a check found. */
export interface FoundUpdate {
  version: string;
  files: ReleaseFile[];
  releaseNotes?: FeedReleaseNotes;
  /** When the update was released, as its `latest*.yml` says. */
  releaseDate?: string;
}

export interface AppUpdatesDependencies {
  /**
   * Loads electron-updater's feed (`autoUpdater`), at the first check: it is half the main bundle, and nothing needs it
   * before that check (`FIRST_CHECK_DELAY_MS` after launch, or one the user asks for).
   */
  loadFeed: () => Promise<UpdateFeed>;
  /** Development builds have no feed: they never check. */
  packaged: boolean;
  /** Whether the app can't install an update itself (`needsManualInstall`: macOS without a Developer ID signature). */
  needsManualInstall: () => Promise<boolean>;
  /** Downloads the disk image of a release (`downloadInstaller`) and returns where it is. */
  downloadInstaller: (file: ReleaseFile, version: string, onProgress: (percent: number) => void) => Promise<string>;
  /** The disk image of a release for this Mac among its files (`installerAsset`). */
  installerOf: (files: readonly ReleaseFile[]) => ReleaseFile | null;
  /** Opens a downloaded disk image, where the user drags the app in, and quits so it can be replaced. */
  openInstaller: (path: string) => Promise<void>;
  /** Whether an operation changing a workspace runs (`OperationTracker.writesRunning`), which restarting would stop partway. */
  writesRunning: () => boolean;
  /** Settles once none runs (`OperationTracker.writesFinished`). */
  writesFinished: () => Promise<void>;
  /** Called just before quitting to install (`Quitting.restartToInstall`): the windows reopen where they were. */
  beforeRestart: () => void;
  /**
   * The `cm` the update of `version` runs, to download with it (docs/features/cm-runtime.md "Updates bring their cm"),
   * so restarting into it never waits on a setup; null when there's none to download (the same one, the installed one
   * chosen). A failure here or in its download never stops the update: its first start sets it up.
   */
  cmPrefetchFor: (version: string) => Promise<CmPrefetch | null>;
  /** Tells every window where the update stands. */
  push: (status: UpdateStatus) => void;
  /** Keeps the cause of a failed check or download, which the window shows only in a sentence (`describeUpdateError`). */
  logFailure: (text: string) => void;
}

/**
 * The app's own updates, from its GitHub releases (electron-builder.yml's `publish`). It checks once shortly after
 * launch and then every hour, and when asked (`check`: the About dialog, the menu); an update found downloads by
 * itself and waits for the user to install it (`install`), or installs when the app quits. Every window hears each
 * step (`push`), and a window that opens reads where it stands (`status`).
 *
 * A macOS build without a Developer ID signature can't install through Squirrel.Mac (`needsManualInstall`): it finds
 * updates the same way, downloads the release's disk image itself and offers to open it. It's asked only once an update
 * is found, as it runs `codesign`.
 *
 * The notes of the update found (`releaseNotes`) come with the check itself: reading them asks nothing more.
 */
export class AppUpdates {
  private current: UpdateStatus;
  private manualInstall: Promise<boolean> | null = null;
  private installerPath: string | null = null;
  private notes: ReleaseNotes[] = [];
  private feedLoaded: Promise<UpdateFeed> | null = null;
  /** The share of the progress the app's own download takes: all of it, or half when its `cm` downloads too. */
  private appShare = 1;

  constructor(private readonly dependencies: AppUpdatesDependencies) {
    this.current = dependencies.packaged ? { state: 'idle' } : { state: 'unavailable' };
  }

  status(): UpdateStatus {
    return this.current;
  }

  /** The notes of every release between the running version and the update found, newest first; none before one is found. */
  releaseNotes(): ReleaseNotes[] {
    return this.notes;
  }

  /** The checks on their own: the first shortly after launch, then every hour. A development build makes none. */
  checkPeriodically(): void {
    if (!this.dependencies.packaged) return;
    setTimeout(() => {
      void this.check();
      // Unref'd: a pending check never keeps the app from quitting.
      setInterval(() => void this.check(), CHECK_INTERVAL_MS).unref();
    }, FIRST_CHECK_DELAY_MS).unref();
  }

  /**
   * Looks for an update and downloads the one found. It always tells where the update stands, so a window that asked
   * hears the answer even when nothing moved: a check, a download or a downloaded update already under way is left as
   * it is, and a development build is `unavailable`.
   */
  async check(): Promise<void> {
    const { state } = this.current;
    if (state === 'unavailable' || state === 'checking' || state === 'downloading' || state === 'ready' || state === 'waitingToInstall') {
      this.dependencies.push(this.current);
      return;
    }
    this.setStatus({ state: 'checking' });
    try {
      const result = await (await this.feed()).checkForUpdates();
      if (!result?.isUpdateAvailable) this.setStatus({ state: 'upToDate' });
      else await this.download(result.updateInfo);
    } catch (error) {
      this.dependencies.logFailure(`[updates] The update failed: ${updateErrorForLog(error)}`);
      this.setStatus({ state: 'failed', error: describeUpdateError(error) });
    }
  }

  /**
   * Installs the downloaded update; nothing while none is ready. Both ways quit the app, so an operation changing a
   * workspace (an update, a checkin…) finishes first (`waitingToInstall`) rather than having its `cm` killed partway.
   */
  async install(): Promise<void> {
    const ready = this.current;
    if (ready.state !== 'ready') return;
    if (this.dependencies.writesRunning()) {
      this.setStatus({ ...ready, state: 'waitingToInstall' });
      await this.dependencies.writesFinished();
    }
    this.dependencies.beforeRestart();
    if (this.installerPath) await this.dependencies.openInstaller(this.installerPath);
    // Silent: the Windows installer runs with no wizard (a per-user install asks for no elevation), then the app starts again.
    else (await this.feed()).quitAndInstall(true, true);
  }

  private async download({ version, files, releaseNotes, releaseDate }: FoundUpdate): Promise<void> {
    this.notes = releaseNotesOf(releaseNotes, version, releaseDate);
    this.setStatus({ state: 'downloading', version, percent: 0 });
    const cm = await this.cmPrefetchFor(version);
    this.appShare = cm ? APP_SHARE_WITH_CM : 1;
    const install = await this.downloadApp(version, files);
    if (cm) await this.downloadCm(version, cm);
    this.setStatus({ state: 'ready', version, install });
  }

  private async downloadApp(version: string, files: ReleaseFile[]): Promise<'restart' | 'installer'> {
    this.manualInstall ??= this.dependencies.needsManualInstall();
    if (!(await this.manualInstall)) {
      await (await this.feed()).downloadUpdate();
      return 'restart';
    }
    const installer = this.dependencies.installerOf(files);
    if (!installer) throw new UpdateFailure(`Version ${version} has no installer for this Mac.`);
    this.installerPath = await this.dependencies.downloadInstaller(installer, version, (percent) =>
      this.setStatus({ state: 'downloading', version, percent: Math.floor(percent * this.appShare) }),
    );
    return 'installer';
  }

  private async cmPrefetchFor(version: string): Promise<CmPrefetch | null> {
    try {
      return await this.dependencies.cmPrefetchFor(version);
    } catch (error) {
      this.dependencies.logFailure(`[updates] The cm of ${version} couldn't be read; it's set up as it starts: ${updateErrorForLog(error)}`);
      return null;
    }
  }

  /** The rest of the progress; a failure only means the update sets its `cm` up as it starts. */
  private async downloadCm(version: string, cm: CmPrefetch): Promise<void> {
    const from = Math.floor(100 * this.appShare);
    try {
      await cm.download((fraction) => {
        const percent = from + Math.floor((100 - from) * fraction);
        if (this.current.state === 'downloading' && percent !== this.current.percent) this.setStatus({ state: 'downloading', version, percent });
      });
    } catch (error) {
      this.dependencies.logFailure(`[updates] The cm of ${version} didn't download; it's set up as it starts: ${updateErrorForLog(error)}`);
    }
  }

  /** The feed, loaded once (`loadFeed`). */
  private feed(): Promise<UpdateFeed> {
    this.feedLoaded ??= this.dependencies.loadFeed().then((feed) => {
      // electron-updater reports fractions many times a second: windows hear whole percents only.
      feed.on('download-progress', (progress) => {
        const percent = Math.floor(progress.percent * this.appShare);
        if (this.current.state === 'downloading' && percent !== this.current.percent) this.setStatus({ ...this.current, percent });
      });
      return feed;
    });
    return this.feedLoaded;
  }

  private setStatus(status: UpdateStatus): void {
    this.current = status;
    this.dependencies.push(status);
  }
}

