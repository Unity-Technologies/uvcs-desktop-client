import { existsSync, readdirSync } from 'node:fs';
import { mkdir, readdir, rename as fsRename, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { cmExecutableName } from '../cm/findInstalledCm';
import { cmInstallFailureOf, CmInstallError } from './cmInstallFailure';
import type { CmBundle } from './cmBundles';
import { cmBundleUrl } from './cmBundles';
import { cmStoreEntries, managedCmPath, storeEntriesToPrune } from './cmStore';
import { downloadBundle, type Fetch } from './downloadBundle';

export type CmInstallProgress =
  | { phase: 'downloading'; receivedBytes: number; totalBytes: number | null }
  /** Unpacking and checking: no measure of its own, a few seconds (longer on Windows, where Defender scans each file). */
  | { phase: 'finishing' };

export interface CmInstallerOptions {
  /** The folder the versions are kept in (`cmStoreFolder`). */
  store: string;
  platform: NodeJS.Platform;
  /** Where the bundles are published (`CM_BUNDLES_URL`, or `UVCS_CM_BUNDLES_URL`). */
  bundlesUrl: string;
  fetch: Fetch;
  /** Unpacks an archive into an existing folder (`unpackBundle`). */
  unpack: (archive: string, destination: string) => Promise<void>;
  /** What `cm version` prints for the `cm` at a path. */
  cmVersionOf: (cmPath: string) => Promise<string>;
  /** `fs.rename`, and a pause between its tries: the tests' own. */
  rename?: (from: string, to: string) => Promise<void>;
  wait?: (ms: number) => Promise<void>;
}

/** The pauses between tries of the final rename, which Windows refuses while a file is held for a moment. */
export const RENAME_RETRY_DELAYS_MS = [100, 200, 400, 800, 1600];

/** The errors of a file held for a moment by another program (Windows' antivirus, its indexer). */
const HELD_FOR_A_MOMENT = new Set(['EPERM', 'EBUSY', 'EACCES']);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function codeOf(error: unknown): string | undefined {
  return typeof error === 'object' && error !== null ? (error as { code?: string }).code : undefined;
}

/**
 * The kind of a failure after the download checked out as published: never the network's. A full disk or a folder
 * that can't be written say so; anything else is this computer not letting it unpack or run (`blocked`).
 */
export function localFailureOf(error: unknown): CmInstallError {
  if (error instanceof CmInstallError) return error;
  const message = error instanceof Error ? error.message : String(error);
  const failure = cmInstallFailureOf(error);
  return new CmInstallError(failure === 'diskFull' || failure === 'notWritable' ? failure : 'blocked', message);
}

/**
 * Downloads, unpacks and checks the app's `cm` into its store, one folder per version (docs/features/cm-runtime.md
 * "Setting it up"). Nothing runs from a version until it's whole: it downloads into `<version>.partial`, unpacks into
 * `<version>.unpacking`, and only once its `cm version` prints the version pinned is that folder renamed to
 * `<version>`, in one step. A failure leaves the download to resume, and the next start or retry goes on from there.
 */
export class CmInstaller {
  /** The installs running, by version: a second ask for the same version joins the first. */
  private readonly running = new Map<string, Promise<string>>();

  constructor(private readonly options: CmInstallerOptions) {}

  /** The `cm` of a version, whether it's there or not. */
  cmPathOf(version: string): string {
    return managedCmPath(this.options.store, version, this.options.platform);
  }

  isInstalled(version: string): boolean {
    return existsSync(this.cmPathOf(version));
  }

  /** Whether any version was ever set up and is still kept: the next one updates it, rather than setting up anew. */
  hasAnyVersion(): boolean {
    try {
      return readdirSync(this.options.store).some((name) => /^\d+\.\d+\.\d+\.\d+$/.test(name));
    } catch {
      return false;
    }
  }

  /** Sets up a version, unless it's there already; resolves with its `cm`. */
  install(version: string, bundle: CmBundle, onProgress: (progress: CmInstallProgress) => void, signal?: AbortSignal): Promise<string> {
    const running = this.running.get(version);
    if (running) return running;
    const install = this.installNow(version, bundle, onProgress, signal).finally(() => this.running.delete(version));
    this.running.set(version, install);
    return install;
  }

  private async installNow(version: string, bundle: CmBundle, onProgress: (progress: CmInstallProgress) => void, signal?: AbortSignal): Promise<string> {
    const cmPath = this.cmPathOf(version);
    if (existsSync(cmPath)) return cmPath;
    const { store, platform, fetch } = this.options;
    const entries = cmStoreEntries(store, version, platform);
    await mkdir(store, { recursive: true });
    const url = cmBundleUrl(version, bundle.file, this.options.bundlesUrl);
    try {
      await downloadBundle({
        fetch,
        url,
        partialPath: entries.partial,
        sha256: bundle.sha256,
        onProgress: (receivedBytes, totalBytes) => onProgress({ phase: 'downloading', receivedBytes, totalBytes }),
        signal,
      });
    } catch (error) {
      // Chromium's errors don't name the address; the details a user copies into a report should.
      const message = error instanceof Error ? error.message : String(error);
      throw new CmInstallError(cmInstallFailureOf(error), message.includes(url) ? message : `${url}\n${message}`);
    }
    onProgress({ phase: 'finishing' });
    try {
      await rm(entries.unpacking, { recursive: true, force: true });
      await mkdir(entries.unpacking);
      await this.unpackAndCheck(entries.partial, entries.unpacking, version);
      await this.moveIntoPlace(entries.unpacking, entries.installed, cmPath);
    } catch (error) {
      await rm(entries.unpacking, { recursive: true, force: true }).catch(() => undefined);
      const failure = localFailureOf(error);
      // What unpacks into another version is downloaded again next time; anything else here is this computer's doing,
      // and the download, checked as published, is kept for Try Again.
      if (failure.failure === 'damaged') await rm(entries.partial, { force: true });
      throw failure;
    }
    await rm(entries.partial, { force: true });
    return cmPath;
  }

  private async unpackAndCheck(archive: string, folder: string, version: string): Promise<void> {
    await this.options.unpack(archive, folder);
    const { platform } = this.options;
    const cmPath = join(folder, 'client', cmExecutableName(platform));
    if (!existsSync(cmPath)) throw new CmInstallError('damaged', `The bundle of ${version} has no client/${cmExecutableName(platform)}`);
    const printed = await this.options.cmVersionOf(cmPath).then(
      (output) => output.trim(),
      (error: unknown) => {
        throw new CmInstallError('blocked', `${cmPath} didn't run: ${error instanceof Error ? error.message : String(error)}`);
      },
    );
    if (printed !== version) throw new CmInstallError('damaged', `The bundle of ${version} holds cm ${printed}`);
  }

  /**
   * Renames the checked folder to the version's, in one step. Windows often refuses it for a moment, while Defender or
   * the indexer still holds a file just written or run: it's tried again a few times (`RENAME_RETRY_DELAYS_MS`), as
   * graceful-fs does. Another copy of the app (a development build beside the installed one) may have set up the same
   * version meanwhile: its folder stands, and this one goes.
   */
  private async moveIntoPlace(unpacking: string, installed: string, cmPath: string): Promise<void> {
    const { rename = fsRename, wait = sleep } = this.options;
    for (let attempt = 0; ; attempt++) {
      try {
        await rm(installed, { recursive: true, force: true });
        await rename(unpacking, installed);
        return;
      } catch (error) {
        if (existsSync(cmPath)) return;
        const delay = RENAME_RETRY_DELAYS_MS[attempt];
        if (delay === undefined || !HELD_FOR_A_MOMENT.has(codeOf(error) ?? '')) throw error;
        await wait(delay);
      }
    }
  }

  /**
   * Deletes every version but the ones kept, and what's left of their downloads. What can't be deleted now (a `cm`
   * still running from it, a file Windows holds) waits for the next start.
   */
  async prune(keep: readonly string[]): Promise<void> {
    const names = await readdir(this.options.store).catch(() => []);
    for (const name of storeEntriesToPrune(names, keep)) {
      await rm(join(this.options.store, name), { recursive: true, force: true }).catch((error: unknown) => console.warn(`[cm] ${name} stays until the next start:`, error));
    }
  }
}
