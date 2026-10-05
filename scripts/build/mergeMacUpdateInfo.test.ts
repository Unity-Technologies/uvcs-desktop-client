import { describe, expect, it } from 'vitest';
import { mergeMacUpdateInfo } from './mergeMacUpdateInfo';

/** latest-mac.yml as one electron-builder run per architecture writes it (`--mac --x64`, `--mac --arm64`). */
const X64 = `version: 1.2.3
files:
  - url: UnityVersionControl-1.2.3-macOS-x64.zip
    sha512: X64ZIP==
    size: 137270666
  - url: UnityVersionControl-1.2.3-macOS-x64.dmg
    sha512: X64DMG==
    size: 137752272
path: UnityVersionControl-1.2.3-macOS-x64.zip
sha512: X64ZIP==
releaseDate: '2026-10-05T08:24:59.384Z'
`;

const ARM64 = `version: 1.2.3
files:
  - url: UnityVersionControl-1.2.3-macOS-arm64.zip
    sha512: ARMZIP==
    size: 130458325
  - url: UnityVersionControl-1.2.3-macOS-arm64.dmg
    sha512: ARMDMG==
    size: 130971154
path: UnityVersionControl-1.2.3-macOS-arm64.zip
sha512: ARMZIP==
releaseDate: '2026-10-05T08:24:50.066Z'
`;

describe("both architectures' latest-mac.yml as one", () => {
  it('lists every file, keeping the first one as the default download', () => {
    expect(mergeMacUpdateInfo([{ name: 'x64', text: X64 }, { name: 'arm64', text: ARM64 }])).toBe(`version: 1.2.3
files:
  - url: UnityVersionControl-1.2.3-macOS-x64.zip
    sha512: X64ZIP==
    size: 137270666
  - url: UnityVersionControl-1.2.3-macOS-x64.dmg
    sha512: X64DMG==
    size: 137752272
  - url: UnityVersionControl-1.2.3-macOS-arm64.zip
    sha512: ARMZIP==
    size: 130458325
  - url: UnityVersionControl-1.2.3-macOS-arm64.dmg
    sha512: ARMDMG==
    size: 130971154
path: UnityVersionControl-1.2.3-macOS-x64.zip
sha512: X64ZIP==
releaseDate: '2026-10-05T08:24:59.384Z'
`);
  });

  it('reads files written with Windows line ends', () => {
    const merged = mergeMacUpdateInfo([
      { name: 'x64', text: X64.replace(/\n/g, '\r\n') },
      { name: 'arm64', text: ARM64.replace(/\n/g, '\r\n') },
    ]);
    expect(merged).toBe(mergeMacUpdateInfo([{ name: 'x64', text: X64 }, { name: 'arm64', text: ARM64 }]));
  });

  it("refuses files of different versions: one architecture's build is from another release", () => {
    expect(() =>
      mergeMacUpdateInfo([{ name: 'x64', text: X64 }, { name: 'arm64', text: ARM64.replace('version: 1.2.3', 'version: 1.2.2') }]),
    ).toThrow('arm64 is version: 1.2.2, x64 is version: 1.2.3.');
  });

  it('refuses a file with no files list', () => {
    expect(() => mergeMacUpdateInfo([{ name: 'x64', text: 'version: 1.2.3\n' }])).toThrow('x64 has no files list.');
  });

  it('refuses nothing to merge', () => {
    expect(() => mergeMacUpdateInfo([])).toThrow('No latest-mac.yml to merge.');
  });
});
