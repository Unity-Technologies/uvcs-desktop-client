/**
 * Sets up the pinned `cm` on this machine with the app's own code (`CmInstaller`: the download, its SHA-256, the
 * system's tar, `cm version`, the rename into place, pruning), as the app does on its first run, with Node's fetch
 * for Electron's net. The cm bundles workflow runs it on every OS the app ships for (`npm run cm:setup-check`, which
 * bundles it first: it imports the app's modules); it sets up into a temp folder whose name has an accent and a space,
 * as a user's profile may, and deletes it after.
 */
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pin from '../../cm-version.json';
import { runCmProcess } from '../../src/main/cm/runCmProcess';
import { CM_BUNDLES_URL, cmBundleFor } from '../../src/main/cmRuntime/cmBundles';
import { CmInstaller } from '../../src/main/cmRuntime/CmInstaller';
import { unpackBundle } from '../../src/main/cmRuntime/unpackBundle';

async function cmVersionOf(cmPath: string): Promise<string> {
  const result = await runCmProcess(cmPath, ['version'], {});
  if (result.exitCode !== 0) throw new Error(`${cmPath} version exited with ${result.exitCode}: ${result.output}`);
  return result.output.trim();
}

async function setUpHere(store: string): Promise<void> {
  const own = cmBundleFor(pin, process.platform, process.arch);
  if (!own) {
    console.log(`No bundle for ${process.platform}-${process.arch}: the app runs the installed cm there.`);
    return;
  }
  console.log(`${process.platform}-${process.arch}: ${own.bundle.file} of ${pin.version}, into ${store}`);
  const installer = new CmInstaller({
    store,
    platform: process.platform,
    bundlesUrl: process.env.UVCS_CM_BUNDLES_URL || CM_BUNDLES_URL,
    fetch: (url, init) => fetch(url, init),
    unpack: (archive, destination) => unpackBundle(archive, destination, process.platform, process.env),
    cmVersionOf,
  });
  const started = Date.now();
  const seconds = (): string => ((Date.now() - started) / 1000).toFixed(1);
  let finishing = false;
  const cmPath = await installer.install(pin.version, own.bundle, (progress) => {
    if (progress.phase !== 'finishing' || finishing) return;
    finishing = true;
    console.log(`Downloaded in ${seconds()} s; unpacking and checking`);
  });
  console.log(`Set up in ${seconds()} s: ${cmPath}`);
  const printed = await cmVersionOf(cmPath);
  if (printed !== pin.version) throw new Error(`cm version printed ${printed}, not ${pin.version}`);
  mkdirSync(join(store, '1.0.0.1'));
  await installer.prune(pin.version);
  const left = readdirSync(store);
  if (left.join() !== pin.version || !existsSync(cmPath)) throw new Error(`The store holds ${left.join(', ')} after pruning`);
  console.log(`cm version ${printed}, run from the store; pruning kept only it.`);
}

const folder = mkdtempSync(join(tmpdir(), 'cm setup José '));
setUpHere(join(folder, 'cm'))
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => rmSync(folder, { recursive: true, force: true, maxRetries: 5 }));
