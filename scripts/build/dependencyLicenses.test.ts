import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isPermissive, nonPermissivePackages } from './dependencyLicenses';

describe('every dependency', () => {
  it('has a permissive license', () => {
    const lockfile = JSON.parse(readFileSync(join(__dirname, '..', '..', 'package-lock.json'), 'utf8'));

    expect(
      nonPermissivePackages(lockfile),
      'These packages have a license that is not on PERMISSIVE_LICENSES (scripts/build/dependencyLicenses.ts). Replace ' +
        'the package, or, once its license is confirmed to allow shipping the app under Apache-2.0, add it to the list.',
    ).toEqual([]);
  });
});

describe('isPermissive', () => {
  it('accepts the permissive licenses, in any case', () => {
    expect(isPermissive('MIT')).toBe(true);
    expect(isPermissive('apache-2.0')).toBe(true);
  });

  it('refuses copyleft, unknown and missing licenses', () => {
    expect(isPermissive('GPL-3.0-only')).toBe(false);
    expect(isPermissive('LGPL-2.1-or-later')).toBe(false);
    expect(isPermissive('MPL-2.0')).toBe(false);
    expect(isPermissive('SEE LICENSE IN LICENSE.md')).toBe(false);
    expect(isPermissive('')).toBe(false);
  });

  it('needs one permissive choice of an OR and every part of an AND', () => {
    expect(isPermissive('(MIT OR CC0-1.0)')).toBe(true);
    expect(isPermissive('WTFPL OR ISC')).toBe(true);
    expect(isPermissive('(GPL-2.0-only OR MIT)')).toBe(true);
    expect(isPermissive('MIT AND BSD-3-Clause')).toBe(true);
    expect(isPermissive('MIT AND GPL-2.0-only')).toBe(false);
  });

  it('refuses a nested expression it cannot read', () => {
    expect(isPermissive('(MIT OR (GPL-2.0-only AND ISC))')).toBe(false);
  });
});

describe('nonPermissivePackages', () => {
  it('names each package that fails, with its license, skipping the app itself', () => {
    const lockfile = {
      packages: {
        '': { license: 'Apache-2.0' },
        'node_modules/react': { license: 'MIT' },
        'node_modules/@scope/copyleft': { license: 'GPL-3.0-only' },
        'node_modules/a/node_modules/nameless': {},
      },
    };
    expect(nonPermissivePackages(lockfile)).toEqual(['@scope/copyleft: GPL-3.0-only', 'nameless: no license']);
  });
});
