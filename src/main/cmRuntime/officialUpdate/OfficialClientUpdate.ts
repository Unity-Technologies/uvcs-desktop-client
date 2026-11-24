import { mkdir, readdir, rename, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { meetsCmVersion, type InstalledCm } from '@shared/domain/cmRuntime';
import type { OfficialUpdate, OfficialUpdateFailure } from '@shared/domain/officialUpdate';
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
  /** Stops `CmClient`'s shells: the installer replaces the files they hold open, and on Windows stops while one runs. */
  stopCm: () => void;
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

function failureOf(error: unknown): OfficialUpdateError {
  if (error instanceof OfficialUpdateError) return error;
  // Anything else stopped the download: the network's, mostly; the address and the error are in the details.
  return new OfficialUpdateError('unreachable', error instanceof Error ? error.message : String(error));
}

/**
 * Updates the official installation of Unity Version Control, as the official client updates itself
 * (docs/features/cm-runtime.md "Updating the installed one"): asks the download site for the latest version of the
 * installed edition, downloads its installer (in the background as soon as the update screen shows: `prepare`), and on
 * the user's click checks it's signed by Unity, stops the app's `cm`, runs it and waits for it, then reads the installed
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

  constructor(private readonly options: OfficialClientUpdateOptions) {}

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
      this.options.stopCm();
      const outcome = await this.options.tools.run(installer);
      if (outcome.kind === 'declined') throw new OfficialUpdateError('declined', 'The permission to install was not given.');
      const after = await this.options.installedAgain();
      if (!after || !meetsCmVersion(after.version, floor)) {
        throw new OfficialUpdateError('notUpdated', `The installer of ${version} ended with exit code ${outcome.exitCode}; the installed version is ${after?.version ?? 'not found'}.`);
      }
      this.ready = null;
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

  /** A signature that isn't Unity's: the installer is deleted, so the next try downloads it again. */
  private async checkSignature(installer: DownloadedInstaller): Promise<void> {
    const verdict = await this.options.tools.checkSignature(installer.path);
    if (verdict.trusted) return;
    this.ready = null;
    await rm(this.options.folder, { recursive: true, force: true }).catch(() => undefined);
    throw new OfficialUpdateError('notSigned', `${verdict.why}: ${installer.path}`);
  }

  /** The installer, downloaded once: asks while it downloads join that download. */
  private downloaded(installed: InstalledCm, floor: string): Promise<DownloadedInstaller> {
    if (this.ready) return Promise.resolve(this.ready);
    this.preparing ??= this.download(installed, floor).finally(() => (this.preparing = null));
    return this.preparing;
  }

  private async download(installed: InstalledCm, floor: string): Promise<DownloadedInstaller> {
    if (!this.installRequested) this.set({ kind: 'lookingUp', installRequested: false });
    const { fetch, folder } = this.options;
    const release = await this.latestRelease(installed, floor);
    const head = await fetch(release.installerUrl, { method: 'HEAD', headers: {} });
    if (!head.ok) throw new OfficialUpdateError('unreachable', `HTTP ${head.status} from ${release.installerUrl}`);
    const finalUrl = head.url || release.installerUrl;
    const name = installerFileName(finalUrl);
    if (!name) throw new OfficialUpdateError('unreachable', `${finalUrl} is no installer`);
    const file = join(folder, name);
    await this.keepOnly(name);
    if (!existsSync(file)) {
      this.reportProgress(release.version, 0, null);
      const partialPath = `${file}.partial`;
      await downloadBundle({ fetch, url: finalUrl, partialPath, sha256: null, onProgress: (received, total) => this.reportProgress(release.version, received, total) });
      await rename(partialPath, file);
    }
    const installer = { path: name.endsWith('.zip') ? await this.unpackedPackage(file) : file, version: release.version };
    this.ready = installer;
    this.set({ kind: 'downloaded', version: release.version });
    return installer;
  }

  /** The latest version of the installed edition, failing as `noUpdate` when it isn't newer or not as new as the floor. */
  private async latestRelease(installed: InstalledCm, floor: string) {
    const { platform, site, fetch } = this.options;
    const url = lastVersionUrl(site, installed.version, this.options.editionOf(installed.path), platform!);
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    const body = await response.text();
    if (!response.ok) throw new OfficialUpdateError('unreachable', `HTTP ${response.status} from ${url}: ${body.slice(0, 200)}`);
    const release = parseLastVersion(body);
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
  }

  private set(state: OfficialUpdate | null): void {
    this.current = state;
    this.options.changed();
  }
}
