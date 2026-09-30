import { describe, expect, it } from 'vitest';
import { installerAsset, type ReleaseFile } from './installerAsset';

// As latest-mac.yml lists them: both architectures' zips first, the x64 one before all.
const files: ReleaseFile[] = [
  { url: 'UnityVersionControl-1.2.0-macOS-x64.zip', sha512: 'zx' },
  { url: 'UnityVersionControl-1.2.0-macOS-arm64.zip', sha512: 'za' },
  { url: 'UnityVersionControl-1.2.0-macOS-x64.dmg', sha512: 'dx' },
  { url: 'UnityVersionControl-1.2.0-macOS-arm64.dmg', sha512: 'da' },
];

describe('installerAsset', () => {
  it("picks the disk image of this Mac's architecture, not the first file listed", () => {
    expect(installerAsset(files, 'arm64', false)?.url).toBe('UnityVersionControl-1.2.0-macOS-arm64.dmg');
    expect(installerAsset(files, 'x64', false)?.url).toBe('UnityVersionControl-1.2.0-macOS-x64.dmg');
  });

  it('moves an x64 build running under Rosetta to the arm64 image', () => {
    expect(installerAsset(files, 'x64', true)?.url).toBe('UnityVersionControl-1.2.0-macOS-arm64.dmg');
  });

  it('finds none in a release without disk images', () => {
    expect(installerAsset(files.slice(0, 2), 'arm64', false)).toBeNull();
  });
});
