import { describe, expect, it } from 'vitest';
import { bundledPackageRoots, LICENSE_FILE_NAME, manifestLicense, packageRootOf, thirdPartyNotices, type BundledPackage } from './thirdPartyNotices';

describe('packageRootOf', () => {
  it('finds the package folder of a bundled module, scoped or not', () => {
    expect(packageRootOf('/repo/node_modules/react/cjs/react.production.js')).toBe('/repo/node_modules/react');
    expect(packageRootOf('/repo/node_modules/@pierre/diffs/dist/index.js')).toBe('/repo/node_modules/@pierre/diffs');
  });

  it('takes the innermost node_modules, a nested copy being a package of its own', () => {
    expect(packageRootOf('/repo/node_modules/@radix-ui/react-dialog/node_modules/@radix-ui/primitive/dist/index.mjs')).toBe(
      '/repo/node_modules/@radix-ui/react-dialog/node_modules/@radix-ui/primitive',
    );
  });

  it('reads Windows paths, virtual module prefixes and queries', () => {
    expect(packageRootOf('C:\\Work\\app\\node_modules\\@tanstack\\react-query\\build\\index.js')).toBe('C:/Work/app/node_modules/@tanstack/react-query');
    expect(packageRootOf('\0C:/Work/app/node_modules/zustand/index.js?commonjs-proxy')).toBe('C:/Work/app/node_modules/zustand');
  });

  it("leaves out the app's own code, virtual helpers and Vite's cache", () => {
    expect(packageRootOf('/repo/src/main/index.ts')).toBeNull();
    expect(packageRootOf('\0commonjsHelpers.js')).toBeNull();
    expect(packageRootOf('/repo/node_modules/.vite/deps/react.js')).toBeNull();
    expect(packageRootOf('/repo/node_modules/@scope')).toBeNull();
  });
});

describe('bundledPackageRoots', () => {
  it('lists each package once, sorted', () => {
    const ids = ['/r/node_modules/zustand/a.js', '/r/src/app.ts', '/r/node_modules/react/index.js', '/r/node_modules/zustand/b.js'];
    expect(bundledPackageRoots(ids)).toEqual(['/r/node_modules/react', '/r/node_modules/zustand']);
  });
});

describe('thirdPartyNotices', () => {
  const packages: Record<string, BundledPackage> = {
    '/r/node_modules/zustand': { name: 'zustand', version: '5.0.0', license: 'MIT', licenseFiles: [{ fileName: 'LICENSE', text: 'MIT License\r\n\r\nCopyright (c) Paul\r\n' }] },
    '/r/node_modules/@pierre/diffs': {
      name: '@pierre/diffs',
      version: '1.5.1',
      license: 'Apache-2.0',
      licenseFiles: [
        { fileName: 'NOTICE.md', text: 'Pierre notice' },
        { fileName: 'LICENSE.md', text: 'Apache License' },
      ],
    },
    '/r/node_modules/a/node_modules/zustand': { name: 'zustand', version: '5.0.0', license: 'MIT', licenseFiles: [] },
    '/r/node_modules/tiny': { name: 'tiny', version: '1.0.0', license: 'ISC', licenseFiles: [] },
  };
  const read = (root: string): BundledPackage => packages[root]!;

  it('writes one section per package and version, by name, with its license files in order and LF line ends', () => {
    const text = thirdPartyNotices(
      ['/r/node_modules/zustand/index.js', '/r/node_modules/@pierre/diffs/dist/a.js', '/r/node_modules/a/node_modules/zustand/index.js'],
      read,
    );
    const sections = text.split(`\n\n${'='.repeat(80)}\n\n`);

    expect(sections[0]).toContain('The app includes the 2 open-source packages below.');
    expect(sections.slice(1)).toEqual([
      '@pierre/diffs 1.5.1\nLicense: Apache-2.0\n\n--- LICENSE.md ---\n\nApache License\n\n--- NOTICE.md ---\n\nPierre notice',
      expect.stringMatching(/^zustand 5\.0\.0\nLicense: MIT\n\n/),
    ]);
    expect(text).not.toContain('\r');
  });

  it('says so when a package has no license file', () => {
    expect(thirdPartyNotices(['/r/node_modules/tiny/index.js'], read)).toContain(
      'tiny 1.0.0\nLicense: ISC\n\n(The package has no license file; its package.json names the license above.)',
    );
  });

  it('lists no package for a bundle of only the app’s own code', () => {
    expect(thirdPartyNotices(['/r/src/main/index.ts'], read)).toContain('the 0 open-source packages');
  });
});

describe('LICENSE_FILE_NAME', () => {
  it('matches the names license files go by, and nothing else', () => {
    const names = ['LICENSE', 'LICENSE.md', 'license.txt', 'LICENCE', 'LICENSE-MIT', 'NOTICE', 'NOTICE.md', 'COPYING', 'README.md', 'licensed.js', 'package.json'];
    expect(names.filter((name) => LICENSE_FILE_NAME.test(name))).toEqual(['LICENSE', 'LICENSE.md', 'license.txt', 'LICENCE', 'LICENSE-MIT', 'NOTICE', 'NOTICE.md', 'COPYING']);
  });
});

describe('manifestLicense', () => {
  it('reads the SPDX field, the older object and list forms, or says it is unknown', () => {
    expect(manifestLicense({ license: 'MIT' })).toBe('MIT');
    expect(manifestLicense({ license: { type: 'BSD-3-Clause' } })).toBe('BSD-3-Clause');
    expect(manifestLicense({ licenses: [{ type: 'MIT' }, { type: 'Apache-2.0' }] })).toBe('(MIT OR Apache-2.0)');
    expect(manifestLicense({ licenses: [{ type: 'ISC' }] })).toBe('ISC');
    expect(manifestLicense({})).toBe('UNKNOWN');
  });
});
