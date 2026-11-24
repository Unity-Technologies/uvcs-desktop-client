import { mkdir, readdir, rename, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { meetsCmVersion, type InstalledCm } from '@shared/domain/cmRuntime';
import type { OfficialUpdate, OfficialUpdateFailure, OfficialUpdateMethod } from '@shared/domain/officialUpdate';
import { downloadBundle, type Fetch } from '../downloadBundle';
import type { OfficialEdition } from './officialEdition';
import { installerFileName, lastVersionUrl, parseLastVersion, type OfficialPlatform } from './officialRelease';
import type { SignatureVerdict } from './installerSignature';

/** A downloaded installer, ready to run: the `.exe`, or the `.pkg` unpacked from its zip. */
export interface DownloadedInstaller {
  path: string;
  version: string;
}

/** How an installer run ended: the user didn't allow it, or it ended by itself, its exit code for the details. */
export type InstallerOutcome = { kind: 'declined' } | { kind: 'ended'; exitCode: number };

/** What the OS does for the update: each a process of its own (`officialUpdateTools`), or a fake in development. */
export interface OfficialUpdateTools {
  /** Whether a downloaded installer is signed by Unity (`authenticodeVerdict`, `pkgutilVerdict`). */
  checkSignature(installer: string): Promise<SignatureVerdict>;
  /** Runs the installer and waits for it to end (`windowsInstallerRun`, `macInstallerRun`). */
  run(installer: DownloadedInstaller): Promise<InstallerOutcome>;
  /** Unpacks the macOS installer's zip into an existing folder (`unpackBundle`). */
  unpack(archive: string, destination: string): Promise<void>;
  /** Linux: the command that updates the package holding `cm` (`linuxUpdateCommand`). */
  linuxUpdateCommand(cmPath: string): Promise<string>;
}

export interface OfficialClientUpdateOptions {
  /** The download site's name for this computer; null where it has no installer. */
  platform: OfficialPlatform | null;
  /** The site asked for the latest version (`OFFICIAL_SITE`, or `UVCS_OFFICIAL_UPDATES_URL`). */
  site: string;
  fetch: Fetch;
  /** Where the installer downloads: a folder of the app's own, emptied once it's installed. */
  folder: string;
  /** The edition of the installation a `cm` belongs to (`officialEditionOf`, its links resolved). */
  editionOf: (cmPath: string) => OfficialEdition;
  tools: OfficialUpdateTools;
  /**
   * Holds `CmClient` while the installer runs (`CmClient.hold`): settles once the commands running ended and its shells
   * with them, as the installer replaces the files they hold open and on Windows stops while one runs; no command starts
   * until the function it settles with resumes it.
   */
  holdCm: () => Promise<() => void>;
  /** The installed `cm` and its version, read again once the installer ended (`CmRuntime.installedCm`). */
  installedAgain: () => Promise<InstalledCm | null>;
  /** Where it stands changed (`state`). */
  changed: () => void;
  now: () => number;
}

/** How often, at most, the download's progress is told. */
const PROGRESS_INTERVAL_MS = 100;

/** A failure whose kind is known: a site with no newer version, a signature that isn't Unity's. */
export class OfficialUpdateError extends Error {
  constructor(
    readonly failure: OfficialUpdateFailure,
    message: string,
  ) {
    super(message);
    this.name = 'OfficialUpdateError';
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** What reaching `url` gave, its failure naming the address for the details (`net::ERR_…` names none). */
async function reaching<T>(url: string, request: Promise<T>): Promise<T> {
  try {
    return await request;
  } catch (error) {
    if (error instanceof OfficialUpdateError) throw error;
    const message = messageOf(error);
    throw new OfficialUpdateError('unreachable', message.includes(url) ? message : `${url}: ${message}`);
  }
}

function failureOf(error: unknown): OfficialUpdateError {
  if (error instanceof OfficialUpdateError) return error;
  // Anything else stopped the download: the network's, mostly; the address and the error are in the details.
  return new OfficialUpdateError('unreachable', messageOf(error));
}

/**
 * Updates the official installation of Unity Version Control, as the official client updates itself
 * (docs/features/cm-runtime.md "Updating the installed one"): asks the download site for the latest version of the
 * installed edition, downloads its installer (in the background as soon as the update screen shows: `prepare`), and on
 * the user's click checks it's signed by Unity, holds the app's `cm`, runs it and waits for it, then reads the installed
 * version again (`install`). On Linux it only names the command that updates it.
 */
export class OfficialClientUpdate {
  private current: OfficialUpdate | null = null;
  private ready: DownloadedInstaller | null = null;
  private preparing: Promise<DownloadedInstaller> | null = null;
  private installing: Promise<boolean> | null = null;
  /** The user asked to install it: a failure from here on is shown, and the download says it's for that. */
  private installRequested = false;
  private lastProgressAt = Number.NEGATIVE_INFINITY;
  /** Told how far the download is, 0 to 1, while an app update waits for it (`downloadAhead`). */
  private progressListener: ((fraction: number) => void) | null = null;
  /** An app update asked for the installer (`downloadAhead`), to run on Restart & Install: `discard` keeps it. */
  private keptForAppUpdate = false;
  /** Stops the download running (`download`), when nothing needs it any more (`discard`). */
  private stopDownload: AbortController | null = null;

  constructor(private readonly options: OfficialClientUpdateOptions) {}

  /** How the installed one is updated here: its installer, a command the user runs (Linux), or neither (no installer for this computer). */
  updatesBy(): OfficialUpdateMethod | null {
    const { platform } = this.options;
    if (platform === null) return null;
    return platform === 'linux' ? 'command' : 'installer';
  }

  /**
   * Downloads the installer of `floor` or newer along with an app update that needs it (docs/features/cm-runtime.md
   * "Updates bring their cm"), telling how far it is, 0 to 1; `install` with the same floor runs it. A failure is
   * thrown, and shows nothing: nobody asked for it yet.
   */
  async downloadAhead(installed: InstalledCm, floor: string, onProgress: (fraction: number) => void): Promise<void> {
    if (this.updatesBy() !== 'installer') throw new OfficialUpdateError('noUpdate', 'This computer has no installer to download.');
    this.progressListener = onProgress;
    this.keptForAppUpdate = true;
    try {
      await this.downloaded(installed, floor);
      onProgress(1);
    } catch (error) {
      this.keptForAppUpdate = false;
      if (!this.installRequested) this.set(null);
      throw error;
    } finally {
      this.progressListener = null;
    }
  }

  /** Where it stands; null when nothing is under way. */
  state(): OfficialUpdate | null {
    return this.current;
  }

  /**
   * Gets the update ready while the user reads the update screen: the installer downloads in the background, or, on
   * Linux, the command is found. A failure here shows nothing: the user's click tries it all again, and says why then.
   */
  async prepare(installed: InstalledCm, floor: string): Promise<void> {
    const { platform } = this.options;
    if (platform === 'linux') {
      if (this.current?.kind !== 'byCommand') this.set({ kind: 'byCommand', command: await this.options.tools.linuxUpdateCommand(installed.path) });
      return;
    }
    if (platform === null || this.installing || this.current?.kind === 'failed') return;
    await this.downloaded(installed, floor).catch(() => {
      if (!this.installRequested) this.set(null);
    });
  }

  /**
   * Nothing needs the update any more: the user runs the included version for now, or a launch found none needed. A
   * download in the background stops, and the folder it downloads into is deleted, along with what an earlier launch
   * left there. An update the user asked to install, or one an app update downloaded for Restart & Install, stays.
   */
  async discard(): Promise<void> {
    if (this.installRequested || this.installing || this.keptForAppUpdate) return;
    this.stopDownload?.abort();
    await this.preparing?.catch(() => undefined);
    this.ready = null;
    await rm(this.options.folder, { recursive: true, force: true }).catch(() => undefined);
    if (this.current && this.current.kind !== 'byCommand') this.set(null);
  }

  /**
   * Installs the update the user asked for: downloads it when it isn't yet, checks it's signed by Unity, stops the app's
   * `cm` and runs it, then reads the installed version. True once the installed one meets the floor; otherwise the state
   * says why not. A second ask while it runs joins it.
   */
  install(installed: InstalledCm, floor: string): Promise<boolean> {
    if (this.options.platform === null || this.options.platform === 'linux') return Promise.resolve(false);
    this.installing ??= this.runInstaller(installed, floor).finally(() => (this.installing = null));
    return this.installing;
  }

  private async runInstaller(installed: InstalledCm, floor: string): Promise<boolean> {
    this.installRequested = true;
    const current = this.current;
    if (current?.kind === 'downloading') this.set({ ...current, installRequested: true });
    else if (!this.ready) this.set({ kind: 'lookingUp', installRequested: true });
    let version: string | null = null;
    try {
      const installer = await this.downloaded(installed, floor);
      version = installer.version;
      this.set({ kind: 'installing', version });
      await this.checkSignature(installer);
      await this.runHoldingCm(installer, floor);
      this.ready = null;
      this.keptForAppUpdate = false;
      await rm(this.options.folder, { recursive: true, force: true }).catch(() => undefined);
      this.set(null);
      return true;
    } catch (error) {
      const { failure, message } = failureOf(error);
      this.set({ kind: 'failed', failure, version, detail: message });
      return false;
    } finally {
      this.installRequested = false;
    }
  }

  /**
   * Runs the installer with `CmClient` held, and reads the installed version again before commands start again: they
   * run on the `cm` it left. Fails unless that version meets the floor.
   */
  private async runHoldingCm(installer: DownloadedInstaller, floor: string): Promise<void> {
    const resumeCm = await this.options.holdCm();
    try {
      const outcome = await this.options.tools.run(installer);
      if (outcome.kind === 'declined') throw new OfficialUpdateError('declined', 'The permission to install was not given.');
      const after = await this.options.installedAgain();
      if (!after || !meetsCmVersion(after.version, floor)) {
        // Installer.app ends `open -W` the same whether it was cancelled or finished: most likely closed unfinished.
        const failure = this.options.platform === 'windows' ? 'notUpdated' : 'notFinished';
        throw new OfficialUpdateError(failure, `The installer of ${installer.version} ended with exit code ${outcome.exitCode}; the installed version is ${after?.version ?? 'not found'}.`);
      }
    } finally {
      resumeCm();
    }
  }

  /** A signature that isn't Unity's: the installer is deleted, so the next try downloads it again. */
  private async checkSignature(installer: DownloadedInstaller): Promise<void> {
    const verdict = await this.options.tools.checkSignature(installer.path);
    if (verdict.trusted) return;
    this.ready = null;
    await rm(this.options.folder, { recursive: true, force: true }).catch(() => undefined);
    throw new OfficialUpdateError('notSigned', `${verdict.why}: ${installer.path}`);
  }

  /**
   * The installer, downloaded once: asks while it downloads join that download. One downloaded for an older floor (the
   * update screen's, before an app update raised it) is passed over.
   */
  private downloaded(installed: InstalledCm, floor: string): Promise<DownloadedInstaller> {
    if (this.ready && meetsCmVersion(this.ready.version, floor)) return Promise.resolve(this.ready);
    if (!this.preparing) {
      const stop = new AbortController();
      this.stopDownload = stop;
      this.preparing = this.download(installed, floor, stop.signal).finally(() => {
        this.preparing = null;
        if (this.stopDownload === stop) this.stopDownload = null;
      });
    }
    return this.preparing;
  }

  private async download(installed: InstalledCm, floor: string, signal: AbortSignal): Promise<DownloadedInstaller> {
    if (!this.installRequested) this.set({ kind: 'lookingUp', installRequested: false });
    const { fetch, folder, platform } = this.options;
    const edition = this.options.editionOf(installed.path);
    const release = await this.latestRelease(installed, edition, floor, signal);
    const name = installerFileName(release.version, edition, platform!);
    const file = join(folder, name);
    await this.keepOnly(name);
    if (!existsSync(file)) {
      this.reportProgress(release.version, 0, null);
      const partialPath = `${file}.partial`;
      // The installer's page redirects to the file; a resumed download's range goes along.
      const download = downloadBundle({ fetch, url: release.installerUrl, partialPath, sha256: null, signal, onProgress: (received, total) => this.reportProgress(release.version, received, total) });
      await reaching(release.installerUrl, download);
      await rename(partialPath, file);
    }
    const installer = { path: name.endsWith('.zip') ? await this.unpackedPackage(file) : file, version: release.version };
    this.ready = installer;
    this.set({ kind: 'downloaded', version: release.version });
    return installer;
  }

  /** The latest version of the installed edition, failing as `noUpdate` when it isn't newer or not as new as the floor. */
  private async latestRelease(installed: InstalledCm, edition: OfficialEdition, floor: string, signal: AbortSignal) {
    const { platform, site, fetch } = this.options;
    const url = lastVersionUrl(site, installed.version, edition, platform!);
    const response = await reaching(url, fetch(url, { headers: { Accept: 'application/json' }, signal }));
    const body = await reaching(url, response.text());
    if (!response.ok) throw new OfficialUpdateError('unreachable', `HTTP ${response.status} from ${url}: ${body.slice(0, 200)}`);
    const release = parseLastVersion(body, site);
    if (!release) throw new OfficialUpdateError('noUpdate', `${url} has no newer version: ${body.slice(0, 200) || 'an empty answer'}`);
    if (!meetsCmVersion(release.version, floor)) throw new OfficialUpdateError('noUpdate', `${url} has ${release.version}, older than ${floor}`);
    return release;
  }

  /** Empties the folder of anything but this installer and its partial download: an older version's, left behind. */
  private async keepOnly(name: string): Promise<void> {
    const { folder } = this.options;
    await mkdir(folder, { recursive: true });
    for (const entry of await readdir(folder)) {
      if (entry !== name && entry !== `${name}.partial`) await rm(join(folder, entry), { recursive: true, force: true });
    }
  }

  /** The `.pkg` the macOS installer's zip holds, unpacked next to it: exactly one, or it isn't the installer. */
  private async unpackedPackage(zip: string): Promise<string> {
    const destination = `${zip}.unpacked`;
    await rm(destination, { recursive: true, force: true });
    await mkdir(destination);
    await this.options.tools.unpack(zip, destination);
    const packages = (await readdir(destination)).filter((entry) => entry.endsWith('.pkg'));
    if (packages.length !== 1) throw new OfficialUpdateError('notSigned', `${zip} holds ${packages.length} installer packages, not one`);
    return join(destination, packages[0]!);
  }

  private reportProgress(version: string, receivedBytes: number, totalBytes: number | null): void {
    const now = this.options.now();
    if (this.current?.kind === 'downloading' && now - this.lastProgressAt < PROGRESS_INTERVAL_MS) return;
    this.lastProgressAt = now;
    this.set({ kind: 'downloading', version, receivedBytes, totalBytes, installRequested: this.installRequested });
    this.progressListener?.(totalBytes ? Math.min(1, receivedBytes / totalBytes) : 0);
  }

  private set(state: OfficialUpdate | null): void {
    this.current = state;
    this.options.changed();
  }
}
