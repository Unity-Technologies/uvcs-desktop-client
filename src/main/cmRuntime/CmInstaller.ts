import { existsSync, readdirSync } from 'node:fs';
import { mkdir, readdir, rename, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { CmInstallError } from './cmInstallFailure';
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
  fetch: Fetch;
  /** Unpacks an archive into an existing folder (`unpackBundle`). */
  unpack: (archive: string, destination: string) => Promise<void>;
  /** What `cm version` prints for the `cm` at a path. */
  cmVersionOf: (cmPath: string) => Promise<string>;
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
    await downloadBundle({
      fetch,
      url: cmBundleUrl(version, bundle.file),
      partialPath: entries.partial,
      sha256: bundle.sha256,
      onProgress: (receivedBytes, totalBytes) => onProgress({ phase: 'downloading', receivedBytes, totalBytes }),
      signal,
    });
    onProgress({ phase: 'finishing' });
    await rm(entries.unpacking, { recursive: true, force: true });
    await mkdir(entries.unpacking);
    try {
      await this.unpackAndCheck(entries.partial, entries.unpacking, version);
    } catch (error) {
      // A bundle that unpacks into something else than the version pinned is downloaded again next time.
      if (error instanceof CmInstallError && error.failure === 'damaged') await rm(entries.partial, { force: true });
      await rm(entries.unpacking, { recursive: true, force: true });
      throw error;
    }
    await this.moveIntoPlace(entries.unpacking, entries.installed, cmPath);
    await rm(entries.partial, { force: true });
    return cmPath;
  }

  private async unpackAndCheck(archive: string, folder: string, version: string): Promise<void> {
    await this.options.unpack(archive, folder);
    const cmPath = join(folder, 'client', this.options.platform === 'win32' ? 'cm.exe' : 'cm');
    if (!existsSync(cmPath)) throw new CmInstallError('damaged', `The bundle of ${version} has no client/${this.options.platform === 'win32' ? 'cm.exe' : 'cm'}`);
    const printed = (await this.options.cmVersionOf(cmPath)).trim();
    if (printed !== version) throw new CmInstallError('damaged', `The bundle of ${version} holds cm ${printed}`);
  }

  /**
   * Renames the checked folder to the version's, in one step. Another copy of the app (a development build beside the
   * installed one) may have set up the same version meanwhile: its folder stands, and this one goes.
   */
  private async moveIntoPlace(unpacking: string, installed: string, cmPath: string): Promise<void> {
    try {
      await rm(installed, { recursive: true, force: true });
      await rename(unpacking, installed);
    } catch (error) {
      await rm(unpacking, { recursive: true, force: true });
      if (!existsSync(cmPath)) throw error;
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
