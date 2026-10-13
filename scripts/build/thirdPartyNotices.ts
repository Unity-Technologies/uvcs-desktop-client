/**
 * THIRD_PARTY_NOTICES.txt: the name, version, license and license files of every package bundled into `out/`. The
 * build minifies the libraries into the app's own files, which drops the license headers that MIT, BSD, ISC and Apache
 * ask to keep with the code, so the notices ship beside it instead (`thirdPartyNoticesPlugin`, electron-builder.yml's
 * `extraResources`). Every package's notice carries a full license text: its own license files, or the text the build
 * supplies for a package that ships none (`SUPPLIED_LICENSES`); a package with neither fails the build. Pure: the
 * plugin passes the bundle's module ids, a way to read a package folder and a way to find a supplied text.
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

/** A license text the build supplies for a package that ships no license file (`SUPPLIED_LICENSES`). */
export interface SuppliedLicenseText {
  /** The license the package's package.json must name for the text to apply. */
  license: string;
  /** Where the text comes from, as the notice shows it. */
  source: string;
  text: string;
}

export type FindSuppliedLicense = (packageName: string) => SuppliedLicenseText | undefined;

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

/**
 * The text of THIRD_PARTY_NOTICES.txt for the packages the modules come from, one section each, by name. Throws when
 * a package has no license text: neither a license file of its own nor a supplied text for the license it names.
 */
export function thirdPartyNotices(moduleIds: Iterable<string>, readPackage: ReadPackage, findSuppliedLicense: FindSuppliedLicense): string {
  const packages = new Map<string, BundledPackage>();
  for (const root of bundledPackageRoots(moduleIds)) {
    const found = readPackage(root);
    // Two folders holding the same version of a package (nested copies) are one notice.
    packages.set(`${found.name}@${found.version}`, found);
  }
  const sorted = [...packages.values()]
    .sort((a, b) => a.name.localeCompare(b.name, 'en') || a.version.localeCompare(b.version, 'en'))
    .map((found) => withLicenseText(found, findSuppliedLicense));
  failOnMissingLicenseTexts(sorted, findSuppliedLicense);

  const header = [
    'Third-party software in Unity Version Control — Desktop',
    '',
    `The app includes the ${sorted.length} open-source packages below. Each one's license and notices follow.`,
  ].join('\n');
  return [header, ...sorted.map(packageNotice)].join(`\n\n${'='.repeat(80)}\n\n`) + '\n';
}

/** The package with the license files its notice shows: its own, or the supplied text when it ships none. */
function withLicenseText(found: BundledPackage, findSuppliedLicense: FindSuppliedLicense): BundledPackage {
  if (found.licenseFiles.length > 0) return found;
  const supplied = findSuppliedLicense(found.name);
  // A supplied text for another license than the one the package names now is stale: no text, so the build fails.
  if (!supplied || supplied.license !== found.license) return found;
  return { ...found, licenseFiles: [{ fileName: `LICENSE (the package ships none; ${supplied.source})`, text: supplied.text }] };
}

function failOnMissingLicenseTexts(packages: BundledPackage[], findSuppliedLicense: FindSuppliedLicense): void {
  const missing = packages.filter((found) => found.licenseFiles.length === 0).map((found) => missingLicenseText(found, findSuppliedLicense));
  if (missing.length === 0) return;
  throw new Error(
    `THIRD_PARTY_NOTICES.txt needs the full license text of every bundled package, and these have none: ${missing.join(', ')}. ` +
      "Add each one's upstream license text to SUPPLIED_LICENSES (scripts/build/suppliedLicenses.ts), for the license its package.json names, " +
      'or review the entry the package has outgrown.',
  );
}

/** A package without a license text, as the build's error names it: a stale `SUPPLIED_LICENSES` entry says so. */
function missingLicenseText(found: BundledPackage, findSuppliedLicense: FindSuppliedLicense): string {
  const supplied = findSuppliedLicense(found.name);
  const stale = supplied ? `; SUPPLIED_LICENSES has ${supplied.license}: review it` : '';
  return `${found.name} ${found.version} (${found.license}${stale})`;
}

function packageNotice(found: BundledPackage): string {
  const title = `${found.name} ${found.version}\nLicense: ${found.license}`;
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
