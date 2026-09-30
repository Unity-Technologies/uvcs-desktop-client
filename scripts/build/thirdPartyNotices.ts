/**
 * THIRD_PARTY_NOTICES.txt: the name, version, license and license files of every package bundled into `out/`. The
 * build minifies the libraries into the app's own files, which drops the license headers that MIT, BSD, ISC and Apache
 * ask to keep with the code, so the notices ship beside it instead (`thirdPartyNoticesPlugin`, electron-builder.yml's
 * `extraResources`). Pure: the plugin passes the bundle's module ids and a way to read a package folder.
 */

/** A package folder as the notices need it: its package.json fields and the text of its license files. */
export interface BundledPackage {
  name: string;
  version: string;
  license: string;
  /** LICENSE, NOTICE, COPYING… found at the package's root, by file name. */
  licenseFiles: { fileName: string; text: string }[];
}

export type ReadPackage = (packageRoot: string) => BundledPackage;

const NODE_MODULES = '/node_modules/';

/** The files a package's license text lives in: LICENSE, LICENCE, LICENSE-MIT, LICENSE.md, NOTICE, COPYING... */
export const LICENSE_FILE_NAME = /^(licen[cs]e|notice|copying)([-._].*)?$/i;

/**
 * The folder of the package a bundled module comes from, or null for the app's own code. Takes the innermost
 * `node_modules` (a nested copy is its own package) and two segments for a scoped name. Rollup's ids can start with
 * `\0` (a plugin's virtual module wrapping a real one) and end with a `?query`; Windows ids can use backslashes.
 */
export function packageRootOf(moduleId: string): string | null {
  const id = moduleId.replace(/^\0/, '').replace(/[?#].*$/, '').replaceAll('\\', '/');
  const start = id.lastIndexOf(NODE_MODULES);
  if (start < 0) return null;

  const segments = id.slice(start + NODE_MODULES.length).split('/');
  const nameLength = segments[0]?.startsWith('@') ? 2 : 1;
  // Vite's own caches (`node_modules/.vite`) aren't packages.
  if (segments.length <= nameLength || segments[0]!.startsWith('.')) return null;
  return id.slice(0, start + NODE_MODULES.length) + segments.slice(0, nameLength).join('/');
}

/** The package folders the modules come from, each once, sorted. */
export function bundledPackageRoots(moduleIds: Iterable<string>): string[] {
  const roots = new Set<string>();
  for (const id of moduleIds) {
    const root = packageRootOf(id);
    if (root) roots.add(root);
  }
  return [...roots].sort();
}

/** The text of THIRD_PARTY_NOTICES.txt for the packages the modules come from, one section each, by name. */
export function thirdPartyNotices(moduleIds: Iterable<string>, readPackage: ReadPackage): string {
  const packages = new Map<string, BundledPackage>();
  for (const root of bundledPackageRoots(moduleIds)) {
    const found = readPackage(root);
    // Two folders holding the same version of a package (nested copies) are one notice.
    packages.set(`${found.name}@${found.version}`, found);
  }
  const sorted = [...packages.values()].sort((a, b) => a.name.localeCompare(b.name, 'en') || a.version.localeCompare(b.version, 'en'));

  const header = [
    'Third-party software in Unity Version Control — Desktop',
    '',
    `The app includes the ${sorted.length} open-source packages below. Each one's license and notices follow.`,
  ].join('\n');
  return [header, ...sorted.map(packageNotice)].join(`\n\n${'='.repeat(80)}\n\n`) + '\n';
}

function packageNotice(found: BundledPackage): string {
  const title = `${found.name} ${found.version}\nLicense: ${found.license}`;
  if (found.licenseFiles.length === 0) return `${title}\n\n(The package has no license file; its package.json names the license above.)`;
  const files = [...found.licenseFiles]
    .sort((a, b) => a.fileName.localeCompare(b.fileName, 'en'))
    .map((file) => `--- ${file.fileName} ---\n\n${file.text.replace(/\r\n?/g, '\n').trim()}`);
  return [title, ...files].join('\n\n');
}

/** The license a package.json names: an SPDX `license`, the older `{ type }` object, or a `licenses` list. */
export function manifestLicense(manifest: { license?: unknown; licenses?: unknown }): string {
  const typeOf = (entry: unknown): string | undefined =>
    typeof entry === 'string' ? entry : typeof entry === 'object' && entry !== null && 'type' in entry ? String(entry.type) : undefined;

  const license = typeOf(manifest.license);
  if (license) return license;
  if (Array.isArray(manifest.licenses)) {
    const types = manifest.licenses.map(typeOf).filter((type): type is string => Boolean(type));
    if (types.length > 0) return types.length === 1 ? types[0]! : `(${types.join(' OR ')})`;
  }
  return 'UNKNOWN';
}
