import { meetsCmVersion, retriesByItself, type CmChoice, type CmRuntimeStatus, type InstalledCm, type OwnCmSwitch } from '@shared/domain/cmRuntime';
import { existsSync } from 'node:fs';
import { isAbsolute } from 'node:path';
import type { CmSetupStart } from '@shared/startingPlace';
import { cmExecutableName } from '../cm/findInstalledCm';
import { chooseCm, type ChosenCm } from './chooseCm';
import { cmBundleFor, type CmVersionPin } from './cmBundles';
import { cmInstallFailureOf } from './cmInstallFailure';
import type { CmInstaller, CmInstallProgress } from './CmInstaller';
import { retryDelayAfter } from './installRetries';

/** A download of another version's `cm`, ahead of the update that runs it. */
export interface CmPrefetch {
  download(onProgress: (fraction: number) => void): Promise<void>;
}

/** How far a prefetch is, 0 to 1: the download, then whole once it's finishing. */
export function prefetchFraction(progress: CmInstallProgress): number {
  if (progress.phase === 'finishing') return 1;
  return progress.totalBytes ? Math.min(1, progress.receivedBytes / progress.totalBytes) : 0;
}

export interface CmRuntimeTimers {
  now: () => number;
  setTimeout: (run: () => void, ms: number) => unknown;
  clearTimeout: (timer: unknown) => void;
}

export interface CmRuntimeOptions {
  pin: CmVersionPin;
  platform: NodeJS.Platform;
  arch: string;
  /** `UVCS_CM_PATH`, which overrides everything. */
  environmentPath: string | undefined;
  installer: Pick<CmInstaller, 'install' | 'isInstalled' | 'cmPathOf' | 'hasAnyVersion'>;
  /** The user's choice in Settings, and saving a new one. */
  choice: () => CmChoice;
  saveChoice: (choice: CmChoice) => void;
  /** The `cm` installed on the computer (`findInstalledCm`), null when none was found. */
  findInstalled: () => string | null;
  /** What `cm version` prints for the `cm` at a path. */
  versionOf: (cmPath: string) => Promise<string>;
  /** The `cm` to run changed: `CmClient` starts its shells again with it (`relocate`). */
  relocated: () => void;
  statusChanged: (status: CmRuntimeStatus) => void;
  /**
   * Once a `cm` runs, the store keeps the pinned version and the newest above it, an update's (`CmInstaller.prune`);
   * development builds, sharing the store, prune nothing.
   */
  prune: (pinnedVersion: string) => void;
  /** Shows a file in the OS's file manager (`shell.showItemInFolder`). */
  reveal: (path: string) => void;
  timers: CmRuntimeTimers;
}

/** How often, at most, a download's progress reaches the windows. */
export const PROGRESS_INTERVAL_MS = 100;

/**
 * The `cm` the app runs (docs/features/cm-runtime.md): which one (`chooseCm`), and setting up the app's own, pinned
 * version when it isn't there yet, retrying by itself while the network is away. `CmClient` asks it for the
 * executable (`cmPath`); the windows for where it stands (`status`, and `cmRuntimeChanged` as it moves on).
 */
export class CmRuntime {
  private chosen: ChosenCm;
  private progress: CmRuntimeStatus | null = null;
  private attempts = 0;
  private retryTimer: unknown = null;
  private lastProgressAt = Number.NEGATIVE_INFINITY;
  private lastPhase: CmInstallProgress['phase'] | null = null;
  /** An install of the pinned version runs (`install`): a second ask while it does joins nothing more. */
  private installing = false;
  private pruned = false;
  /** The app's own `cm` downloading to replace the installed one (`useOwnWhenDownloaded`). */
  private switchingToOwn: OwnCmSwitch | null = null;
  /** What waits for `cm` to run (`whenReady`). */
  private waitingForReady: (() => void)[] = [];
  /** No version of the app's own `cm` was set up before this one: setting up, rather than updating. */
  private firstRun: boolean;

  constructor(private readonly options: CmRuntimeOptions) {
    this.chosen = this.choose();
    this.firstRun = !options.installer.hasAnyVersion();
  }

  /** The version this app runs as its own. */
  get pinnedVersion(): string {
    return this.options.pin.version;
  }

  /** Whether the app has a `cm` of its own here: a bundle for this platform (none for Linux on Arm). */
  hasOwnCm(): boolean {
    return cmBundleFor(this.options.pin, this.options.platform, this.options.arch) !== null;
  }

  /**
   * Shows the `cm` that runs in the file manager (Help ▸ Show Command Line Client, About): the app's own in its store,
   * or the installed one. Nothing for one not found, named only by its bare name.
   */
  revealCm(): void {
    const path = this.cmPath();
    if (isAbsolute(path) && existsSync(path)) this.options.reveal(path);
  }

  /** The executable `CmClient` runs. */
  cmPath(): string {
    return this.chosen.path;
  }

  /** Whether that `cm` can run now: false while the app's own is still being set up. */
  isReady(): boolean {
    return this.chosen.source !== 'managed' || this.options.installer.isInstalled(this.pinnedVersion);
  }

  /** The setup running, if any, as a window opened now names it in its address (`cmSetupQuery`). */
  setupRunning(): CmSetupStart | null {
    if (this.isReady()) return null;
    return this.firstRun ? 'settingUp' : 'updating';
  }

  status(): CmRuntimeStatus {
    if (this.isReady()) return this.switchingToOwn ? { kind: 'ready', source: this.chosen.source, switchingToOwn: this.switchingToOwn } : { kind: 'ready', source: this.chosen.source };
    return this.progress ?? this.installingStatus({ phase: 'downloading', receivedBytes: 0, totalBytes: null });
  }

  /** Settles once `cm` can run: at once when it can, or when the app's own is set up. */
  whenReady(): Promise<void> {
    if (this.isReady()) return Promise.resolve();
    return new Promise((resolve) => this.waitingForReady.push(resolve));
  }

  /** Sets up the app's own `cm` if it runs and isn't there; prunes the store once a `cm` runs. */
  start(): void {
    if (this.isReady()) this.pruneOnce();
    else void this.install();
  }

  /** Tries the setup again now: the user asked, or the network came back. */
  retry(): void {
    if (this.status().kind !== 'failed') return;
    this.cancelRetry();
    void this.install();
  }

  /**
   * Runs the installed `cm` from now on, or the app's own again (Settings, or the setup's failure screen). An installed
   * one older than the pinned version is never taken (`usableInstalledCm`). Going back to the app's own before it's
   * there keeps the installed one running while it downloads (`useOwnWhenDownloaded`): the windows never lose what they
   * show for a setup screen.
   */
  async use(choice: CmChoice): Promise<void> {
    if (choice === 'installed' && !(await this.usableInstalledCm())) return;
    if (choice === 'managed' && this.chosen.source === 'installed' && this.hasOwnCm() && !this.options.installer.isInstalled(this.pinnedVersion)) {
      void this.useOwnWhenDownloaded();
      return;
    }
    // Any other choice drops a switch to its own still downloading (`useOwnWhenDownloaded` checks it's still wanted).
    this.switchingToOwn = null;
    this.options.saveChoice(choice);
    this.switchTo(this.choose());
  }

  /**
   * Whether the `cm` at `executable`, which printed `version`, may run the app (`system.cmVersion` asks each `cm` it
   * reads). Only an installed one older than the pinned version may not: where the app has its own, it runs that from
   * now on (setting it up first if it isn't there), and the choice is saved; where it has none, nothing runs.
   */
  admits(executable: string, version: string): boolean {
    if (this.chosen.source !== 'installed' || executable !== this.chosen.path || meetsCmVersion(version, this.pinnedVersion)) return true;
    if (this.hasOwnCm()) {
      this.switchingToOwn = null;
      this.options.saveChoice('managed');
      this.switchTo(this.choose());
    }
    return false;
  }

  private switchTo(chosen: ChosenCm): void {
    if (chosen.path !== this.chosen.path || chosen.source !== this.chosen.source) {
      this.chosen = chosen;
      this.options.relocated();
    }
    this.cancelRetry();
    this.progress = null;
    this.announce();
    if (!this.isReady()) void this.install();
  }

  private async useOwnWhenDownloaded(): Promise<void> {
    if (this.switchingToOwn?.kind === 'downloading') return;
    const own = cmBundleFor(this.options.pin, this.options.platform, this.options.arch)!;
    this.switchingToOwn = { kind: 'downloading', fraction: null };
    this.announce();
    try {
      await this.options.installer.install(this.pinnedVersion, own.bundle, (progress) => {
        if (this.switchingToOwn?.kind !== 'downloading') return;
        this.switchingToOwn = { kind: 'downloading', fraction: progress.phase === 'downloading' && !progress.totalBytes ? null : prefetchFraction(progress) };
        this.announceProgress(progress.phase);
      });
      if (this.switchingToOwn?.kind !== 'downloading') return;
      this.switchingToOwn = null;
      this.options.saveChoice('managed');
      this.switchTo(this.choose());
    } catch (error) {
      if (this.switchingToOwn?.kind !== 'downloading') return;
      this.switchingToOwn = { kind: 'failed', failure: cmInstallFailureOf(error), detail: error instanceof Error ? error.message : String(error) };
      this.announce();
    }
  }

  /**
   * The download of the `cm` an update pins, along with the update (docs/features/cm-runtime.md "Updates bring their
   * cm"); null when there's nothing to download: the app's own isn't the one running, this platform has no bundle,
   * or that version is there already.
   */
  prefetchFor(pin: CmVersionPin): CmPrefetch | null {
    if (this.chosen.source !== 'managed') return null;
    const own = cmBundleFor(pin, this.options.platform, this.options.arch);
    if (!own || this.options.installer.isInstalled(pin.version)) return null;
    return {
      download: async (onProgress) => {
        await this.options.installer.install(pin.version, own.bundle, (progress) => onProgress(prefetchFraction(progress)));
      },
    };
  }

  /** The `cm` installed on the computer, with its version; null when none is found or it doesn't run. */
  async installedCm(): Promise<InstalledCm | null> {
    const path = this.options.findInstalled();
    if (!path) return null;
    try {
      return { path, version: (await this.options.versionOf(path)).trim() };
    } catch {
      return null;
    }
  }

  /** The installed `cm` when it may run the app: the pinned version or newer (`meetsCmVersion`). */
  private async usableInstalledCm(): Promise<InstalledCm | null> {
    const installed = await this.installedCm();
    return installed && meetsCmVersion(installed.version, this.pinnedVersion) ? installed : null;
  }

  private choose(): ChosenCm {
    const { pin, platform, arch, environmentPath, installer } = this.options;
    const bundle = cmBundleFor(pin, platform, arch);
    const candidates = {
      environmentPath,
      choice: this.options.choice(),
      installedPath: this.options.findInstalled(),
      managedPath: bundle ? installer.cmPathOf(pin.version) : null,
    };
    return chooseCm(candidates, cmExecutableName(platform));
  }

  private installingStatus(progress: CmInstallProgress): CmRuntimeStatus {
    const { firstRun } = this;
    if (progress.phase === 'downloading') return { kind: 'installing', version: this.pinnedVersion, ...progress, firstRun };
    // Finishing: the download is whole.
    const downloaded = this.progress?.kind === 'installing' ? (this.progress.totalBytes ?? this.progress.receivedBytes) : 0;
    return { kind: 'installing', version: this.pinnedVersion, phase: 'finishing', receivedBytes: downloaded, totalBytes: downloaded || null, firstRun };
  }

  private report(progress: CmInstallProgress): void {
    this.progress = this.installingStatus(progress);
    this.announceProgress(progress.phase);
  }

  /** Tells the windows a download moved on: at most every `PROGRESS_INTERVAL_MS`, and at each change of phase. */
  private announceProgress(phase: CmInstallProgress['phase']): void {
    const now = this.options.timers.now();
    if (phase === this.lastPhase && now - this.lastProgressAt < PROGRESS_INTERVAL_MS) return;
    this.lastPhase = phase;
    this.lastProgressAt = now;
    this.announce();
  }

  /** Tells the windows where it stands; once a `cm` runs, wakes what waited for it and prunes the store. */
  private announce(): void {
    const status = this.status();
    this.options.statusChanged(status);
    if (status.kind !== 'ready') return;
    for (const resolve of this.waitingForReady.splice(0)) resolve();
    this.pruneOnce();
  }

  /** Once a launch, as a `cm` first runs: what the store holds changes only by this app's own installs after that. */
  private pruneOnce(): void {
    if (this.pruned) return;
    this.pruned = true;
    this.options.prune(this.pinnedVersion);
  }

  private async install(): Promise<void> {
    const { pin, platform, arch, installer } = this.options;
    const bundle = cmBundleFor(pin, platform, arch);
    if (!bundle || this.installing) return;
    this.installing = true;
    this.lastPhase = null;
    this.report({ phase: 'downloading', receivedBytes: 0, totalBytes: null });
    try {
      await installer.install(this.pinnedVersion, bundle.bundle, (progress) => this.report(progress));
      this.attempts = 0;
      this.progress = null;
      // A choice made while it downloaded may have left the app's own behind: the installed one runs, as announced.
      if (this.chosen.source !== 'managed') return;
      this.options.relocated();
      this.announce();
    } catch (error) {
      await this.failed(error);
    } finally {
      this.installing = false;
    }
  }

  private async failed(error: unknown): Promise<void> {
    const failure = cmInstallFailureOf(error);
    const detail = error instanceof Error ? error.message : String(error);
    this.progress = { kind: 'failed', version: this.pinnedVersion, failure, detail, firstRun: this.firstRun, installedCm: await this.usableInstalledCm() };
    if (this.chosen.source !== 'managed') return;
    this.announce();
    if (retriesByItself(failure)) {
      this.retryTimer = this.options.timers.setTimeout(() => this.retry(), retryDelayAfter(this.attempts++));
    }
  }

  private cancelRetry(): void {
    if (this.retryTimer !== null) this.options.timers.clearTimeout(this.retryTimer);
    this.retryTimer = null;
  }
}
