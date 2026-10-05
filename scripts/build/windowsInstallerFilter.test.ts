import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { useReadableInstallerFilter } from './windowsInstallerFilter';

const BUILDER_CONFIG = join(__dirname, '..', '..', 'electron-builder.yml');

describe('Windows installer filter', () => {
  // The arm64 installer otherwise leaves out the app's .exe and DLLs (windowsInstallerFilter.ts).
  it('packs a Windows build with a filter the installer can read', () => {
    const env: NodeJS.ProcessEnv = {};
    useReadableInstallerFilter('win32', env);
    expect(env.ELECTRON_BUILDER_7Z_FILTER).toBe('BCJ');
  });

  it('leaves the macOS and Linux builds as they are', () => {
    const env: NodeJS.ProcessEnv = {};
    useReadableInstallerFilter('darwin', env);
    useReadableInstallerFilter('linux', env);
    expect(env).toEqual({});
  });

  it('runs before every build packs', () => {
    expect(readFileSync(BUILDER_CONFIG, 'utf8')).toMatch(/^beforePack: \.\/scripts\/build\/windowsInstallerFilter\.ts\s*$/m);
  });
});
