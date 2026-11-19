import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { pinProblems } from '../../src/main/cmRuntime/cmBundles.ts';
import { changedBundles, pinOf, pinText } from './cmVersion.ts';

const HASHES = {
  'win32-x64': 'a'.repeat(64),
  'darwin-x64': 'b'.repeat(64),
  'darwin-arm64': 'c'.repeat(64),
  'linux-x64': 'd'.repeat(64),
};

describe('pinOf', () => {
  it('pins every bundle by its file and hash', () => {
    const pin = pinOf('11.0.16.10659', HASHES);
    expect(pinProblems(pin)).toEqual([]);
    expect(pin.bundles['darwin-arm64']).toEqual({ file: 'client-macos-arm64.tar.gz', sha256: 'c'.repeat(64) });
  });
});

describe('pinText', () => {
  it('writes the file as it is checked in, one bundle per line', () => {
    const checkedIn = readFileSync(resolve(import.meta.dirname, '../../cm-version.json'), 'utf8').replace(/\r\n/g, '\n');
    expect(pinText(JSON.parse(checkedIn))).toBe(checkedIn);
  });
});

describe('changedBundles', () => {
  it('names nothing when every published bundle has its pinned hash', () => {
    expect(changedBundles(pinOf('11.0.16.10659', HASHES), HASHES)).toEqual([]);
  });

  it('names a bundle republished with other bytes', () => {
    const published = { ...HASHES, 'linux-x64': 'e'.repeat(64) };
    expect(changedBundles(pinOf('11.0.16.10659', HASHES), published)).toEqual([
      `linux-x64 (client-linux.tar.gz): pinned ${'d'.repeat(64)}, published ${'e'.repeat(64)}`,
    ]);
  });
});
