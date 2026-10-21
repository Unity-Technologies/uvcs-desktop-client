import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..', '..');
const builderConfig = readFileSync(join(ROOT, 'electron-builder.yml'), 'utf8').replaceAll('\r\n', '\n');
const packageJson = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as { desktopName?: string };

describe("the app's Linux .desktop file", () => {
  // Electron's name for the app otherwise is a slug of its product name, and electron-builder names the file after the
  // package: the launcher would never find the icon whose progress bar the app sets.
  it('is named as Electron names the app, after its id', () => {
    const appId = builderConfig.match(/^appId: (\S+)$/m)?.[1];
    expect(packageJson.desktopName).toBe(`${appId}.desktop`);
    expect(builderConfig).toMatch(/^linux:\n(?: {2}.*\n)*? {2}syncDesktopName: true$/m);
  });
});
