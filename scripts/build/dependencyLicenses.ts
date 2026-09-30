/**
 * The licenses a dependency may have: permissive ones, which let the app be shipped under Apache-2.0 with only their
 * notices kept (THIRD_PARTY_NOTICES.txt). A copyleft license (GPL, LGPL, MPL, EUPL...) would put conditions on the
 * app itself, so a package under one needs a legal decision first. SPDX ids, compared case-insensitively as SPDX says.
 */
export const PERMISSIVE_LICENSES: readonly string[] = [
  'MIT',
  'ISC',
  'Apache-2.0',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'BlueOak-1.0.0',
  '0BSD',
  'CC0-1.0',
  'CC-BY-4.0',
  'Python-2.0',
  'WTFPL',
];

const PERMISSIVE = new Set(PERMISSIVE_LICENSES.map((license) => license.toLowerCase()));

/**
 * Whether an SPDX expression lets the app use the package: `A OR B` needs one permissive choice, `A AND B` needs both.
 * Covers the flat expressions package.json files use (`(MIT OR CC0-1.0)`, `WTFPL OR ISC`); anything else is refused.
 */
export function isPermissive(expression: string): boolean {
  const flat = expression.trim().replace(/^\((.*)\)$/, '$1');
  if (/[()]/.test(flat) || flat === '') return false;
  return flat.split(/\s+OR\s+/i).some((choice) => choice.split(/\s+AND\s+/i).every((license) => PERMISSIVE.has(license.trim().toLowerCase())));
}

/** The packages of a package-lock.json (v2 or v3) whose license isn't permissive, as `path: license`. */
export function nonPermissivePackages(lockfile: { packages?: Record<string, { license?: string }> }): string[] {
  return Object.entries(lockfile.packages ?? {})
    .filter(([path]) => path !== '')
    .filter(([, entry]) => !isPermissive(entry.license ?? ''))
    .map(([path, entry]) => `${path.replace(/^.*node_modules\//, '')}: ${entry.license ?? 'no license'}`);
}
