import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CM_BUNDLES_URL, cmBundleUrl, type CmBundle } from './cmBundles';
import { cmInstallFailureOf, CmInstallError } from './cmInstallFailure';
import { CmInstaller, type CmInstallProgress } from './CmInstaller';
import { fakeBundleSite, sha256Of } from './testing/fakeBundleSite';

const VERSION = '11.0.16.10659';
const ARCHIVE = new TextEncoder().encode('an archive holding client/cm');
const BUNDLE: CmBundle = { file: 'client-linux.tar.gz', sha256: sha256Of(ARCHIVE) };
const CM = process.platform === 'win32' ? 'cm.exe' : 'cm';

interface Setup {
  /** What the unpacked `cm` prints as its version. */
  printedVersion?: string;
  unpack?: (archive: string, destination: string) => Promise<void>;
  site?: ReturnType<typeof fakeBundleSite>;
}

async function installerWith(setup: Setup = {}) {
  const store = join(await mkdtemp(join(tmpdir(), 'cm-store-')), 'cm');
  const site = setup.site ?? fakeBundleSite({ [cmBundleUrl(VERSION, BUNDLE.file)]: ARCHIVE }, {}, 8);
  const unpacked: string[] = [];
  const installer = new CmInstaller({
    store,
    platform: process.platform,
    bundlesUrl: CM_BUNDLES_URL,
    fetch: site.fetch,
    unpack:
      setup.unpack ??
      (async (_archive, destination) => {
        unpacked.push(destination);
        await mkdir(join(destination, 'client'));
        await writeFile(join(destination, 'client', CM), 'cm');
      }),
    cmVersionOf: async () => `${setup.printedVersion ?? VERSION}\n`,
  });
  return { installer, store, site, unpacked };
}

describe('CmInstaller', () => {
  it('downloads, unpacks and checks a version, then keeps only its folder', async () => {
    const { installer, store } = await installerWith();
    const progress: CmInstallProgress[] = [];
    const cmPath = await installer.install(VERSION, BUNDLE, (step) => progress.push(step));
    expect(cmPath).toBe(join(store, VERSION, 'client', CM));
    expect(installer.isInstalled(VERSION)).toBe(true);
    expect(await readdir(store)).toEqual([VERSION]);
    expect(progress.at(-2)).toEqual({ phase: 'downloading', receivedBytes: ARCHIVE.length, totalBytes: ARCHIVE.length });
    expect(progress.at(-1)).toEqual({ phase: 'finishing' });
  });

  it('downloads nothing for a version already there', async () => {
    const { installer, site } = await installerWith();
    await installer.install(VERSION, BUNDLE, () => undefined);
    await installer.install(VERSION, BUNDLE, () => undefined);
    expect(site.requests).toHaveLength(1);
  });

  it('joins a second ask for a version being set up', async () => {
    const { installer, site } = await installerWith();
    const [first, second] = await Promise.all([installer.install(VERSION, BUNDLE, () => undefined), installer.install(VERSION, BUNDLE, () => undefined)]);
    expect(second).toBe(first);
    expect(site.requests).toHaveLength(1);
  });

  it('fails as damaged when the bundle holds another version, keeping nothing to run or resume', async () => {
    const { installer, store } = await installerWith({ printedVersion: '11.0.16.10600' });
    const install = installer.install(VERSION, BUNDLE, () => undefined);
    await expect(install.catch(cmInstallFailureOf)).resolves.toBe('damaged');
    expect(await readdir(store)).toEqual([]);
  });

  it('fails as damaged when the bundle has no cm where every bundle has it', async () => {
    const { installer } = await installerWith({ unpack: async () => undefined });
    await expect(installer.install(VERSION, BUNDLE, () => undefined).catch(cmInstallFailureOf)).resolves.toBe('damaged');
  });

  it('keeps the download to resume when unpacking stops on a full disk', async () => {
    const { installer, store } = await installerWith({
      unpack: async () => {
        throw new CmInstallError('diskFull', 'No space left on device');
      },
    });
    await expect(installer.install(VERSION, BUNDLE, () => undefined).catch(cmInstallFailureOf)).resolves.toBe('diskFull');
    expect(await readdir(store)).toEqual([`${VERSION}.partial`]);
  });

  it('fails as offline, naming the address, with nothing in place when there is no network', async () => {
    const site = fakeBundleSite({}, { error: new Error('net::ERR_INTERNET_DISCONNECTED') });
    const { installer } = await installerWith({ site });
    const failure = await installer.install(VERSION, BUNDLE, () => undefined).catch((error: Error) => ({ kind: cmInstallFailureOf(error), message: error.message }));
    expect(failure).toEqual({ kind: 'offline', message: `${cmBundleUrl(VERSION, BUNDLE.file)}\nnet::ERR_INTERNET_DISCONNECTED` });
    expect(installer.isInstalled(VERSION)).toBe(false);
  });

  it('prunes every version but the ones kept', async () => {
    const { installer, store } = await installerWith();
    await installer.install(VERSION, BUNDLE, () => undefined);
    for (const name of ['11.0.16.9000', '11.0.16.10700.partial', 'notes']) await mkdir(join(store, name));
    await installer.prune([VERSION]);
    expect((await readdir(store)).sort()).toEqual([VERSION, 'notes'].sort());
    expect(existsSync(installer.cmPathOf(VERSION))).toBe(true);
  });

  it('prunes nothing when the store doesn’t exist yet', async () => {
    const { installer } = await installerWith();
    await expect(installer.prune([VERSION])).resolves.toBeUndefined();
  });
});
