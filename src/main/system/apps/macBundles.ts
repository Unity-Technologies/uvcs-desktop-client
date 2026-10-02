import { posix } from 'node:path';

const BUNDLE_ID_ATTRIBUTE = 'kMDItemCFBundleIdentifier';

/**
 * The `mdfind` arguments asking Spotlight, in one query, where every app with one of these bundle identifiers is: an
 * app is found wherever it was installed, not only in /Applications (GitHub Desktop asks Launch Services the same).
 * Each line of the answer names the bundle and the identifier it matched (`-attr`).
 */
export function bundleQueryArgs(bundleIds: string[]): string[] {
  const query = bundleIds.map((id) => `${BUNDLE_ID_ATTRIBUTE} == '${id.replaceAll("'", '')}'`).join(' || ');
  return ['-attr', BUNDLE_ID_ATTRIBUTE, query];
}

/**
 * Where each bundle identifier is installed, from `mdfind -attr` lines (`/Applications/Zed.app   kMDItemCFBundleIdentifier = dev.zed.Zed`).
 * Spotlight also indexes copies the user doesn't run (in the Trash, a mounted disk image, a translocated download), so
 * those are left out, and of several copies the one in /Applications wins, then ~/Applications, then the system's.
 */
export function parseBundleLocations(output: string, home: string): Map<string, string> {
  const found = new Map<string, string[]>();
  for (const line of output.split(/\r?\n/)) {
    const match = /^(.+\.app)\s+kMDItemCFBundleIdentifier = (\S+)\s*$/.exec(line);
    if (!match) continue;
    const [, bundle, id] = match as unknown as [string, string, string];
    if (!isInstalledCopy(bundle, home)) continue;
    found.set(id, [...(found.get(id) ?? []), bundle]);
  }
  return new Map([...found].map(([id, bundles]) => [id, preferredCopy(bundles, home)]));
}

function isInstalledCopy(bundle: string, home: string): boolean {
  return !(bundle.includes('/.Trash/') || bundle.startsWith('/Volumes/') || bundle.startsWith('/private/') || bundle.startsWith(posix.join(home, 'Library/')));
}

function preferredCopy(bundles: string[], home: string): string {
  const preference = ['/Applications/', posix.join(home, 'Applications') + '/', '/System/Applications/'];
  const rank = (bundle: string): number => {
    const index = preference.findIndex((folder) => bundle.startsWith(folder));
    return index === -1 ? preference.length : index;
  };
  return [...bundles].sort((a, b) => rank(a) - rank(b) || a.length - b.length)[0]!;
}
