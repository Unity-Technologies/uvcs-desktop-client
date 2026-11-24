/**
 * Writes and checks `cm-version.json`, the `cm` this version of the app runs (docs/features/cm-runtime.md "The pin").
 *
 *   npm run cm:bump <version>   downloads that version's bundles, runs this machine's `cm version` from its bundle, and
 *                               writes the pin with each bundle's SHA-256; fails when any bundle is missing
 *   npm run cm:check            downloads the pinned bundles again and fails when one changed or is gone: the Release
 *                               workflow runs it before building, and the cm bundles workflow every day
 *
 * Both also fail unless the official installers of every edition, on Windows and both Macs, are published at that
 * version or newer (`unpublishedInstallers`): the update screen's Update installs one of them.
 *
 * The bundles are 45-130 MB each: both take a minute or two.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createWriteStream, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream } from 'node:stream/web';
import {
  CM_BUNDLE_FILES,
  CM_VERSION_FORMAT,
  cmBundleFor,
  cmBundleUrl,
  pinProblems,
  type CmBundleKey,
  type CmVersionPin,
} from '../../src/main/cmRuntime/cmBundles.ts';
import { tarPath } from '../../src/main/cmRuntime/tarPath.ts';
import { OFFICIAL_SITE } from '../../src/main/cmRuntime/officialUpdate/officialRelease.ts';
import { installerQuestions, unpublishedInstallers } from './cmInstallersPublished.ts';

const PIN_FILE = resolve(import.meta.dirname, '../../cm-version.json');

/** The pin of `version`, from each bundle's hash, keyed as `CM_BUNDLE_FILES` lists them. */
export function pinOf(version: string, hashes: Readonly<Record<CmBundleKey, string>>): CmVersionPin {
  const bundles = Object.fromEntries(
    Object.entries(CM_BUNDLE_FILES).map(([key, file]) => [key, { file, sha256: hashes[key as CmBundleKey] }]),
  );
  return { version, bundles };
}

/** The pin as the file holds it: one bundle per line, so a bump's diff reads at a glance. */
export function pinText(pin: CmVersionPin): string {
  const bundles = Object.entries(pin.bundles).map(
    ([key, { file, sha256 }]) => `    ${JSON.stringify(key)}: { "file": ${JSON.stringify(file)}, "sha256": ${JSON.stringify(sha256)} }`,
  );
  return `{\n  "version": ${JSON.stringify(pin.version)},\n  "bundles": {\n${bundles.join(',\n')}\n  }\n}\n`;
}

/** The bundles whose published file no longer has the pinned hash, one line each; none when all match. */
export function changedBundles(pin: CmVersionPin, published: Readonly<Record<CmBundleKey, string>>): string[] {
  return Object.entries(pin.bundles)
    .filter(([key, bundle]) => published[key as CmBundleKey] !== bundle.sha256)
    .map(([key, bundle]) => `${key} (${bundle.file}): pinned ${bundle.sha256}, published ${published[key as CmBundleKey]}`);
}

async function download(url: string, destination: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok || !response.body) throw new Error(`${url}: HTTP ${response.status}`);
  const hash = createHash('sha256');
  const body = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
  body.on('data', (chunk: Buffer) => hash.update(chunk));
  await pipeline(body, createWriteStream(destination));
  return hash.digest('hex');
}

/** Downloads every bundle of `version` into `folder`, returning each one's SHA-256. */
async function downloadBundles(version: string, folder: string): Promise<Record<CmBundleKey, string>> {
  const entries = await Promise.all(
    Object.entries(CM_BUNDLE_FILES).map(async ([key, file]) => {
      const hash = await download(cmBundleUrl(version, file), join(folder, file));
      console.log(`${key}  ${hash}  ${file}`);
      return [key, hash] as const;
    }),
  );
  return Object.fromEntries(entries);
}

/** Unpacks this machine's bundle and runs its `cm version`, which must print the version pinned. */
function checkRunsHere(pin: CmVersionPin, folder: string): void {
  const own = cmBundleFor(pin, process.platform, process.arch);
  if (!own) {
    console.log(`No bundle runs on ${process.platform}-${process.arch}: cm version not checked.`);
    return;
  }
  const unpacked = join(folder, 'unpacked');
  mkdirSync(unpacked);
  // The system's tar, as the app unpacks: on Windows System32's, which reads the zip (Git's GNU tar doesn't).
  const tar = spawnSync(tarPath(process.platform, process.env), ['-xf', join(folder, own.bundle.file), '-C', unpacked], { stdio: 'inherit' });
  if (tar.status !== 0) throw new Error(`Couldn't unpack ${own.bundle.file}`);
  const cm = join(unpacked, 'client', process.platform === 'win32' ? 'cm.exe' : 'cm');
  const printed = spawnSync(cm, ['version'], { encoding: 'utf8' }).stdout?.trim();
  if (printed !== pin.version) throw new Error(`${own.bundle.file}'s cm version printed "${printed}", not ${pin.version}`);
  console.log(`cm version: ${printed}`);
}

/** Asks the download site for every edition's latest installer; fails unless each is `version` or newer. */
async function checkInstallersPublished(version: string): Promise<void> {
  const answers = await Promise.all(
    installerQuestions(OFFICIAL_SITE, version).map(async (question) => {
      const response = await fetch(question.url, { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`${question.url}: HTTP ${response.status}`);
      return { ...question, body: await response.text() };
    }),
  );
  const unpublished = unpublishedInstallers(version, answers);
  if (unpublished.length > 0) throw new Error(`The official installers don't have ${version} yet:\n${unpublished.join('\n')}`);
  console.log(`The official installers have ${version} or newer.`);
}

async function bump(version: string | undefined): Promise<void> {
  if (!version || !CM_VERSION_FORMAT.test(version)) throw new Error('Usage: npm run cm:bump <version>, like 11.0.16.10659');
  await checkInstallersPublished(version);
  const folder = mkdtempSync(join(tmpdir(), 'cm-bump-'));
  try {
    const pin = pinOf(version, await downloadBundles(version, folder));
    checkRunsHere(pin, folder);
    writeFileSync(PIN_FILE, pinText(pin));
    console.log(`cm-version.json now pins ${version}.`);
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
}

async function check(): Promise<void> {
  const pin = JSON.parse(readFileSync(PIN_FILE, 'utf8')) as CmVersionPin;
  const problems = pinProblems(pin);
  if (problems.length > 0) throw new Error(`cm-version.json: ${problems.join('; ')}`);
  await checkInstallersPublished(pin.version);
  const folder = mkdtempSync(join(tmpdir(), 'cm-check-'));
  try {
    const changed = changedBundles(pin, await downloadBundles(pin.version, folder));
    if (changed.length > 0) throw new Error(`The published bundles of ${pin.version} changed:\n${changed.join('\n')}`);
    console.log(`The bundles of ${pin.version} are as pinned.`);
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
}

if (import.meta.filename === resolve(process.argv[1] ?? '')) {
  const [command, version] = process.argv.slice(2);
  const run = command === 'bump' ? bump(version) : command === 'check' ? check() : Promise.reject(new Error('Usage: cmVersion.ts bump <version> | check'));
  run.catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
