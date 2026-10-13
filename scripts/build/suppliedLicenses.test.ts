import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SUPPLIED_LICENSES, SUPPLIED_LICENSES_FOLDER } from './suppliedLicenses';
import { manifestLicense } from './thirdPartyNotices';

describe('SUPPLIED_LICENSES', () => {
  const lockfile = JSON.parse(readFileSync(join(__dirname, '..', '..', 'package-lock.json'), 'utf8')) as {
    packages: Record<string, { license?: unknown; licenses?: unknown }>;
  };

  it.each(Object.entries(SUPPLIED_LICENSES))('supplies %s a full license text with its copyright', (_name, supplied) => {
    const text = readFileSync(join(SUPPLIED_LICENSES_FOLDER, supplied.fileName), 'utf8');

    // A full text, not a name: the license's own wording, with the holder's copyright line.
    expect(text.trim().split(/\r?\n/).length).toBeGreaterThan(10);
    expect(text).toMatch(/^Copyright \(c\) .+$/m);
  });

  it.each(Object.entries(SUPPLIED_LICENSES))('names %s with the license package-lock.json gives it', (name, supplied) => {
    // An entry for a package no longer installed, or relicensed since, is stale: remove or review it.
    expect(manifestLicense(lockfile.packages[`node_modules/${name}`] ?? {})).toBe(supplied.license);
  });
});
