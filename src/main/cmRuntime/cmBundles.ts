/**
 * The `cm` this version of the app runs, as `cm-version.json` at the repository's root pins it: one exact version, and
 * per platform the bundle that holds it and the SHA-256 of that file (docs/features/cm-runtime.md "The pin").
 *
 * No imports: `scripts/build/cmVersion.ts` runs this module with Node as it is, to bump and check the pin.
 */

/** A platform and architecture as Node names them, joined: `darwin-arm64`, `win32-x64`. */
export type CmBundleKey = `${string}-${string}`;

export interface CmBundle {
  /** The bundle's file name on the download site, the same for every version: `client-macos-arm64.tar.gz`. */
  file: string;
  /** The SHA-256 of that file, in lowercase hex: what was published when the pin was written, byte for byte. */
  sha256: string;
}

export interface CmVersionPin {
  /** The exact `cm` version, as `cm version` prints it: `11.0.16.10659`. */
  version: string;
  bundles: Record<CmBundleKey, CmBundle>;
}

/** Where Unity publishes the `cm` bundles of every version. */
export const CM_BUNDLES_URL = 'https://www.plasticscm.com/download/clientbundle';

/** The bundles a pin holds, one per platform the app is built for that has one (no Linux arm64 bundle exists). */
export const CM_BUNDLE_FILES: Readonly<Record<CmBundleKey, string>> = {
  'win32-x64': 'client-windows.zip',
  'darwin-x64': 'client-macos.tar.gz',
  'darwin-arm64': 'client-macos-arm64.tar.gz',
  'linux-x64': 'client-linux.tar.gz',
};

/**
 * Architectures that run another one's bundle: no Windows arm64 bundle exists, and Windows on Arm runs the x64 one
 * emulated.
 */
const EMULATED_ARCHITECTURES: Readonly<Record<CmBundleKey, CmBundleKey>> = { 'win32-arm64': 'win32-x64' };

/** The bundle this platform downloads, and its key in the pin; null when there is none and the installed `cm` runs. */
export function cmBundleFor(pin: CmVersionPin, platform: string, arch: string): { key: CmBundleKey; bundle: CmBundle } | null {
  const own: CmBundleKey = `${platform}-${arch}`;
  const key = EMULATED_ARCHITECTURES[own] ?? own;
  const bundle = pin.bundles[key];
  return bundle ? { key, bundle } : null;
}

/**
 * The address of one version's bundle. Never `latest`, which lags behind the versions published. `bundlesUrl` is
 * another site laid out the same way (`UVCS_CM_BUNDLES_URL`: the smoke test's, a failure shown on purpose).
 */
export function cmBundleUrl(version: string, file: string, bundlesUrl: string = CM_BUNDLES_URL): string {
  return `${bundlesUrl.replace(/\/+$/, '')}/${encodeURIComponent(version)}/${encodeURIComponent(file)}`;
}

/** A version as `cm version` prints it: four numbers. */
export const CM_VERSION_FORMAT = /^\d+\.\d+\.\d+\.\d+$/;

/** A SHA-256 in lowercase hex. */
export const SHA256_FORMAT = /^[0-9a-f]{64}$/;

/** What's wrong with a pin, one line per problem; none when it's sound. */
export function pinProblems(pin: CmVersionPin): string[] {
  const problems: string[] = [];
  if (!CM_VERSION_FORMAT.test(pin.version)) problems.push(`version "${pin.version}" isn't four numbers`);
  const keys = Object.keys(pin.bundles).sort();
  const expected = Object.keys(CM_BUNDLE_FILES).sort();
  if (keys.join() !== expected.join()) problems.push(`bundles are ${keys.join(', ')}; expected ${expected.join(', ')}`);
  for (const [key, bundle] of Object.entries(pin.bundles)) {
    const file = CM_BUNDLE_FILES[key as CmBundleKey];
    if (file && bundle.file !== file) problems.push(`${key} names ${bundle.file}; expected ${file}`);
    if (!SHA256_FORMAT.test(bundle.sha256)) problems.push(`${key}'s sha256 isn't 64 lowercase hex digits`);
  }
  return problems;
}

/** Compares two versions number by number: negative when `a` is older. */
export function compareCmVersions(a: string, b: string): number {
  const left = a.split('.').map(Number);
  const right = b.split('.').map(Number);
  for (let index = 0; index < Math.max(left.length, right.length); index++) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}
