import { join } from 'node:path';

/**
 * The license texts of bundled packages whose npm package ships no license file. THIRD_PARTY_NOTICES.txt must carry
 * the full license text of every bundled package (`thirdPartyNotices` fails the build otherwise), so each package here
 * has its text in `scripts/build/suppliedLicenses/<fileName>`, copied as it is from where `source` says. A package
 * that ships its own license file never uses its entry: the package's own text always wins.
 *
 * Reviewed by hand: an entry is added only after reading the package's upstream repository, and its `license` must be
 * the one the package's package.json names, or the build fails (a relicensed package never gets a stale text).
 */

/** The folder holding the supplied texts, one file per package (`SuppliedLicense.fileName`). */
// This file's folder, under vitest and in the build alike: electron-vite bundles electron.vite.config.ts with what it
// imports, and gives each bundled file its own __dirname.
export const SUPPLIED_LICENSES_FOLDER = join(__dirname, 'suppliedLicenses');

/** A license text the build supplies for a package that ships none. */
export interface SuppliedLicense {
  /** The license the package's package.json names; the build fails when the package names another. */
  license: string;
  /** The file in `scripts/build/suppliedLicenses/` holding the text. */
  fileName: string;
  /** Where the text comes from, as the notice shows it. */
  source: string;
}

export const SUPPLIED_LICENSES: Readonly<Record<string, SuppliedLicense>> = {
  // The upstream repository's LICENSE, as it is.
  'react-remove-scroll-bar': {
    license: 'MIT',
    fileName: 'react-remove-scroll-bar.txt',
    source: 'taken from github.com/theKashey/react-remove-scroll-bar/blob/7301c160fda4/LICENSE',
  },
  // The upstream repository's LICENSE.txt, as it is.
  lru_map: {
    license: 'MIT',
    fileName: 'lru_map.txt',
    source: 'taken from github.com/rsms/js-lru/blob/f9381a69e17c/LICENSE.txt',
  },
  // The upstream repository (github.com/develar/lazy-val) has no license file either; its package.json declares MIT
  // and names Vladimir Krivosheev as the author, so the text is the standard MIT License with his copyright.
  'lazy-val': {
    license: 'MIT',
    fileName: 'lazy-val.txt',
    source: 'the standard MIT License text, as its package.json names; upstream github.com/develar/lazy-val has no license file',
  },
};
