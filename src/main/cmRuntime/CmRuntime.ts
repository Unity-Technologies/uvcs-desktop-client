import { retriesByItself, type CmChoice, type CmRuntimeStatus, type InstalledCm } from '@shared/domain/cmRuntime';
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
  /** Versions downloaded for an update waiting to install: kept until it starts, as its own. */
  private readonly prefetched = new Set<string>();
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
    if (this.isReady()) return { kind: 'ready', source: this.chosen.source };
    return this.progress ?? this.installingStatus({ phase: 'downloading', receivedBytes: 0, totalBytes: null });
  }

  /** Sets up the app's own `cm` if it runs and isn't there; nothing otherwise. */
  start(): void {
    if (!this.isReady()) void this.install();
  }

  /** Tries the setup again now: the user asked, or the network came back. */
  retry(): void {
    if (this.status().kind !== 'failed') return;
    this.cancelRetry();
    void this.install();
  }

  /** Runs the installed `cm` from now on, or the app's own again (Settings, or the setup's failure screen). */
  use(choice: CmChoice): void {
    this.options.saveChoice(choice);
    const chosen = this.choose();
    if (chosen.path !== this.chosen.path || chosen.source !== this.chosen.source) {
      this.chosen = chosen;
      this.options.relocated();
    }
    this.cancelRetry();
    this.progress = null;
    this.options.statusChanged(this.status());
    this.start();
  }

  /** The versions to keep when pruning the store: the pinned one, and any an update downloaded ahead. */
  keptVersions(): string[] {
    return [this.pinnedVersion, ...this.prefetched];
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
        this.prefetched.add(pin.version);
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
    const previous = this.progress;
    this.progress = this.installingStatus(progress);
    const now = this.options.timers.now();
    const phaseChanged = previous?.kind !== 'installing' || previous.phase !== progress.phase;
    if (!phaseChanged && now - this.lastProgressAt < PROGRESS_INTERVAL_MS) return;
    this.lastProgressAt = now;
    this.options.statusChanged(this.progress);
  }

  private async install(): Promise<void> {
    const { pin, platform, arch, installer } = this.options;
    const bundle = cmBundleFor(pin, platform, arch);
    if (!bundle) return;
    const version = this.pinnedVersion;
    this.report({ phase: 'downloading', receivedBytes: 0, totalBytes: null });
    try {
      await installer.install(version, bundle.bundle, (progress) => this.report(progress));
      this.attempts = 0;
      this.progress = null;
      // A choice made while it downloaded may have left the app's own behind.
      if (this.chosen.source !== 'managed') return;
      this.options.relocated();
      this.options.statusChanged(this.status());
    } catch (error) {
      await this.failed(error);
    }
  }

  private async failed(error: unknown): Promise<void> {
    const failure = cmInstallFailureOf(error);
    const detail = error instanceof Error ? error.message : String(error);
    this.progress = { kind: 'failed', version: this.pinnedVersion, failure, detail, firstRun: this.firstRun, installedCm: await this.installedCm() };
    if (this.chosen.source !== 'managed') return;
    this.options.statusChanged(this.progress);
    if (retriesByItself(failure)) {
      this.retryTimer = this.options.timers.setTimeout(() => this.retry(), retryDelayAfter(this.attempts++));
    }
  }

  private cancelRetry(): void {
    if (this.retryTimer !== null) this.options.timers.clearTimeout(this.retryTimer);
    this.retryTimer = null;
  }
}
