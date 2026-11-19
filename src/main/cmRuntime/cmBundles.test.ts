import { describe, expect, it } from 'vitest';
import pin from '../../../cm-version.json';
import { cmBundleFor, cmBundleUrl, compareCmVersions, pinProblems, type CmVersionPin } from './cmBundles';

const PIN: CmVersionPin = {
  version: '11.0.16.10659',
  bundles: {
    'win32-x64': { file: 'client-windows.zip', sha256: 'a'.repeat(64) },
    'darwin-x64': { file: 'client-macos.tar.gz', sha256: 'b'.repeat(64) },
    'darwin-arm64': { file: 'client-macos-arm64.tar.gz', sha256: 'c'.repeat(64) },
    'linux-x64': { file: 'client-linux.tar.gz', sha256: 'd'.repeat(64) },
  },
};

describe('cm-version.json', () => {
  it('pins one exact version with a bundle and a hash for every platform that has one', () => {
    expect(pinProblems(pin)).toEqual([]);
  });
});

describe('pinProblems', () => {
  it('names a version that is not four numbers, a missing bundle, a renamed file and a bad hash', () => {
    const { 'linux-x64': _linux, ...bundles } = PIN.bundles;
    const broken: CmVersionPin = {
      version: 'latest',
      bundles: { ...bundles, 'win32-x64': { file: 'client.zip', sha256: 'A'.repeat(64) } },
    };
    expect(pinProblems(broken)).toEqual([
      'version "latest" isn\'t four numbers',
      'bundles are darwin-arm64, darwin-x64, win32-x64; expected darwin-arm64, darwin-x64, linux-x64, win32-x64',
      'win32-x64 names client.zip; expected client-windows.zip',
      "win32-x64's sha256 isn't 64 lowercase hex digits",
    ]);
  });
});

describe('cmBundleFor', () => {
  it('takes the bundle of the platform and architecture', () => {
    expect(cmBundleFor(PIN, 'darwin', 'arm64')).toEqual({ key: 'darwin-arm64', bundle: PIN.bundles['darwin-arm64'] });
    expect(cmBundleFor(PIN, 'linux', 'x64')?.key).toBe('linux-x64');
  });

  it('gives Windows on Arm the x64 bundle, which it runs emulated', () => {
    expect(cmBundleFor(PIN, 'win32', 'arm64')).toEqual({ key: 'win32-x64', bundle: PIN.bundles['win32-x64'] });
  });

  it('has none for a platform without a bundle, which runs the installed cm', () => {
    expect(cmBundleFor(PIN, 'linux', 'arm64')).toBeNull();
  });
});

describe('cmBundleUrl', () => {
  it('names the exact version, never latest', () => {
    expect(cmBundleUrl('11.0.16.10659', 'client-linux.tar.gz')).toBe(
      'https://www.plasticscm.com/download/clientbundle/11.0.16.10659/client-linux.tar.gz',
    );
  });
});

describe('compareCmVersions', () => {
  it('compares number by number, not as text', () => {
    expect(compareCmVersions('11.0.16.9876', '11.0.16.10659')).toBeLessThan(0);
    expect(compareCmVersions('11.0.16.10659', '11.0.16.10659')).toBe(0);
    expect(compareCmVersions('12.0.0.1', '11.9.99.99999')).toBeGreaterThan(0);
  });
});
