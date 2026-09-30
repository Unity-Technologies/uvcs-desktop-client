import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { Plugin } from 'vite';
import { LICENSE_FILE_NAME, manifestLicense, thirdPartyNotices, type BundledPackage } from './thirdPartyNotices';

/**
 * Writes `outFile` (THIRD_PARTY_NOTICES.txt) with the packages of every bundle the plugin sees. electron-vite builds
 * main, preload and renderer (and the renderer's workers) one bundle at a time, so one collector serves them all: each
 * bundle adds its modules and rewrites the file, and the last one leaves the notices of the whole app.
 */
export function thirdPartyNoticesCollector(outFile: string): { plugin: () => Plugin } {
  const moduleIds = new Set<string>();

  return {
    plugin: () => ({
      name: 'uvcs:third-party-notices',
      apply: 'build',
      generateBundle(_options, bundle) {
        for (const output of Object.values(bundle)) {
          if (output.type !== 'chunk') continue;
          // Only modules that left code in the chunk: a package tree-shaken away ships nothing to credit.
          for (const [id, module] of Object.entries(output.modules)) if (module.renderedLength > 0) moduleIds.add(id);
        }
      },
      writeBundle() {
        mkdirSync(dirname(outFile), { recursive: true });
        writeFileSync(outFile, thirdPartyNotices(moduleIds, readPackageFolder));
      },
    }),
  };
}

function readPackageFolder(packageRoot: string): BundledPackage {
  const manifest = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8')) as { name: string; version: string; license?: unknown; licenses?: unknown };
  const licenseFiles = readdirSync(packageRoot, { withFileTypes: true })
    .filter((entry) => entry.isFile() && LICENSE_FILE_NAME.test(entry.name))
    .map((entry) => ({ fileName: entry.name, text: readFileSync(join(packageRoot, entry.name), 'utf8') }));
  return { name: manifest.name, version: manifest.version, license: manifestLicense(manifest), licenseFiles };
}
