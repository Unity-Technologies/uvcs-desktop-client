import { meetsCmVersion, retriesByItself, type CmChoice, type CmRuntimeStatus, type CmUserChoice, type InstalledCm, type OwnCmSwitch } from '@shared/domain/cmRuntime';
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
  /**
   * The pinned version for which the user ran the app's own rather than update an older installed one
   * (`cmDeclinedUpdateFor`), and saving it: not asked again until the pin moves.
   */
  declinedUpdateFor: () => string | null;
  saveDeclinedUpdate: (pinnedVersion: string) => void;
  /** The `cm` installed on the computer (`findInstalledCm`), null when none was found. */
  findInstalled: () => string | null;
  /** What `cm version` prints for the `cm` at a path. */
  versionOf: (cmPath: string) => Promise<string>;
  /** The `cm` to run changed: `CmClient` starts its shells again with it (`relocate`). */
  relocated: () => void;
  statusChanged: (status: CmRuntimeStatus) => void;
  /**
   * Once a `cm` runs, the store keeps the pinned version and the newest above it, an update's, or nothing when the
   * installed one runs (`CmInstaller.prune`, `keep` null); development builds, sharing the store, prune nothing.
   */
  prune: (keep: string | null) => void;
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
  /** Counts the user's choices (`use`): one still checking the installed `cm`'s version yields to a later one. */
  private choiceTurn = 0;
  /** What waits for `cm` to run (`whenReady`). */
  private waitingForReady: (() => void)[] = [];
  /** No version of the app's own `cm` was set up before this one: setting up, rather than updating. */
  private firstRun: boolean;
  /** The installed `cm` found older than the pinned version, waiting for the user to update it (the update screen). */
  private updateNeeded: InstalledCm | null = null;
  /** The installed `cm` this launch found older than the pinned version, passed over for the app's own. */
  private refusedInstalledPath: string | null = null;
  /** Where the app has no `cm` of its own, the installed one, too old to run: nothing runs (`admits`). */
  private unrunnable: InstalledCm | null = null;
  /** Check Again reading the installed `cm`'s version (`checkInstalledAgain`): asks while it does join it. */
  private checkingInstalled: Promise<void> | null = null;

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

  /** Whether that `cm` can run now: false while the app's own is still being set up, or the installed one needs an update. */
  isReady(): boolean {
    if (this.updateNeeded) return false;
    return this.chosen.source !== 'managed' || this.options.installer.isInstalled(this.pinnedVersion);
  }

  /** The setup running, if any, as a window opened now names it in its address (`cmSetupQuery`). */
  setupRunning(): CmSetupStart | null {
    if (this.isReady()) return null;
    return this.firstRun ? 'settingUp' : 'updating';
  }

  status(): CmRuntimeStatus {
    if (this.updateNeeded) return { kind: 'installedTooOld', installed: this.updateNeeded, requiredVersion: this.pinnedVersion };
    if (this.isReady()) {
      const { switchingToOwn, unrunnable } = this;
      return {
        kind: 'ready',
        source: this.chosen.source,
        ...(switchingToOwn && { switchingToOwn }),
        ...(unrunnable && { installedTooOld: { installed: unrunnable, requiredVersion: this.pinnedVersion } }),
      };
    }
    return this.progress ?? this.installingStatus({ phase: 'downloading', receivedBytes: 0, totalBytes: null });
  }

  /** Settles once `cm` can run: at once when it can, or when the app's own is set up. */
  whenReady(): Promise<void> {
    if (this.isReady()) return Promise.resolve();
    return new Promise((resolve) => this.waitingForReady.push(resolve));
  }

  /**
   * Sets up the app's own `cm` if it runs and isn't there; prunes the store once a `cm` runs (an installed one, once its
   * version is known to be new enough: `admits`).
   */
  start(): void {
    if (!this.isReady()) void this.install();
    else if (this.chosen.source !== 'installed') this.pruneOnce();
  }

  /** Tries the setup again now: the user asked, or the network came back. */
  retry(): void {
    if (this.status().kind !== 'failed') return;
    this.cancelRetry();
    void this.install();
  }

  /**
   * Runs the installed `cm` from now on, or the app's own again (Settings, or the setup's failure screen). An installed
   * one older than the pinned version is never taken (`usableInstalledCm`): Settings never offers it. Going back to the
   * app's own before it's there keeps the installed one running while it downloads (`useOwnWhenDownloaded`): the windows
   * never lose what they show for a setup screen.
   */
  async use(choice: CmUserChoice): Promise<void> {
    const turn = ++this.choiceTurn;
    // Refused without a word: Settings never offers an older one, nor does the setup's failure screen.
    if (choice === 'installed' && !(await this.usableInstalledCm())) return;
    if (turn !== this.choiceTurn) return;
    if (choice === 'managed' && this.chosen.source === 'installed' && this.hasOwnCm() && !this.options.installer.isInstalled(this.pinnedVersion)) {
      void this.useOwnWhenDownloaded();
      return;
    }
    // Any other choice drops a switch to its own still downloading (`useOwnWhenDownloaded` checks it's still wanted).
    this.switchingToOwn = null;
    this.options.saveChoice(choice);
    this.refusedInstalledPath = null;
    this.switchTo(this.choose());
  }

  /**
   * "Use the included version for now", on the update screen: runs the app's own, set up first when it isn't there,
   * and remembers it for this pinned version, so the update screen doesn't ask again until the pin moves. The choice
   * stays as it was: once the installed one is new enough, it runs again without asking.
   */
  useIncludedForNow(): void {
    if (!this.updateNeeded) return;
    this.options.saveDeclinedUpdate(this.pinnedVersion);
    this.refusedInstalledPath = this.updateNeeded.path;
    this.updateNeeded = null;
    this.switchTo(this.choose());
  }

  /**
   * Check Again, on the update screen (asked as the user presses it and as a window gains focus, never on a timer):
   * reads the installed `cm`'s version again, and runs it once it's new enough; the app's own when none is found any
   * more. A second ask while one reads joins it.
   */
  checkInstalledAgain(): Promise<void> {
    if (!this.updateNeeded) return Promise.resolve();
    this.checkingInstalled ??= this.readInstalledAgain().finally(() => (this.checkingInstalled = null));
    return this.checkingInstalled;
  }

  private async readInstalledAgain(): Promise<void> {
    const installed = await this.installedCm();
    const before = this.updateNeeded;
    // "Use the included version for now" while it read.
    if (!before) return;
    if (installed && !meetsCmVersion(installed.version, this.pinnedVersion)) {
      if (installed.path === before.path && installed.version === before.version) return;
      this.updateNeeded = installed;
      this.announce();
      return;
    }
    this.updateNeeded = null;
    // Its shells, started before its version answered, run the executable the update replaced: started again.
    this.switchTo(this.choose(), { relocate: true });
  }

  /**
   * Whether the `cm` at `executable`, which printed `version`, may run the app (`system.cmVersion` asks each `cm` it
   * reads). Only an installed one older than the pinned version may not: where the app has its own, the update screen
   * asks to update it (`refuse`); where it has none, nothing runs. An installed one new enough runs, and the store is
   * pruned of the app's own.
   */
  admits(executable: string, version: string): boolean {
    if (this.chosen.source !== 'installed' || executable !== this.chosen.path) return true;
    if (meetsCmVersion(version, this.pinnedVersion)) {
      this.setUnrunnable(null);
      this.pruneOnce();
      return true;
    }
    const installed = { path: executable, version: version.trim() };
    if (this.hasOwnCm()) this.refuse(installed);
    else this.setUnrunnable(installed);
    return false;
  }

  private setUnrunnable(installed: InstalledCm | null): void {
    if (installed?.version === this.unrunnable?.version && installed?.path === this.unrunnable?.path) return;
    this.unrunnable = installed;
    this.announce();
  }

  /**
   * An installed `cm` older than the pinned version: the update screen, or, when the user chose the app's own for this
   * pinned version already ("Use the included version for now"), the app's own at once, without asking.
   */
  private refuse(installed: InstalledCm): void {
    this.switchingToOwn = null;
    if (this.options.declinedUpdateFor() === this.pinnedVersion) {
      this.refusedInstalledPath = installed.path;
      this.switchTo(this.choose());
      return;
    }
    this.updateNeeded = installed;
    this.cancelRetry();
    this.progress = null;
    this.announce();
  }

  private switchTo(chosen: ChosenCm, { relocate = false } = {}): void {
    if (relocate || chosen.path !== this.chosen.path || chosen.source !== this.chosen.source) {
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
      installedPath: this.usableInstalledPath(),
      managedPath: bundle ? installer.cmPathOf(pin.version) : null,
    };
    return chooseCm(candidates, cmExecutableName(platform));
  }

  /** The installed `cm` found, unless this launch passed it over as too old (`refuse`). */
  private usableInstalledPath(): string | null {
    const found = this.options.findInstalled();
    return found === this.refusedInstalledPath ? null : found;
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

  /**
   * Tells the windows where it stands; once a `cm` runs, wakes what waited for it and prunes the store (for an installed
   * one, once its version is known: `admits`).
   */
  private announce(): void {
    const status = this.status();
    this.options.statusChanged(status);
    if (status.kind !== 'ready') return;
    for (const resolve of this.waitingForReady.splice(0)) resolve();
    if (status.source !== 'installed') this.pruneOnce();
  }

  /**
   * Once a launch, as a `cm` first runs: what the store holds changes only by this app's own installs after that. While
   * the installed one runs, the app's own isn't kept at all: it's downloaded again if ever needed.
   */
  private pruneOnce(): void {
    if (this.pruned) return;
    this.pruned = true;
    this.options.prune(this.chosen.source === 'installed' ? null : this.pinnedVersion);
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
