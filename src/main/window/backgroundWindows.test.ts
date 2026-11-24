import { readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { filesUnder } from '@shared/testing/filesUnder';
import { windowsStayInBackground } from './backgroundWindows';

const ROOT = join(__dirname, '..', '..', '..');
/**
 * The only scripts that run the app with its windows in the background: the smoke test's, the one-shot screenshot, and
 * `app:debug` when an agent asks with `--background`. Never `npm run dev`, `npm start` or an installer.
 */
const SETS_IT = ['scripts/app-debug.mjs', 'scripts/e2e/setupScreen.mjs', 'scripts/e2e/smoke.mjs', 'scripts/screenshot.mjs'];
/** What only names the switch: its own module, and the docs that say what it does. Tests never launch the app. */
const NAMES_IT = ['src/main/window/backgroundWindows.ts', 'scripts/e2e/README.md'];
/** Where a launch could set it: the app's sources, the scripts, CI, the installers and the build's configuration. */
const SCANNED_DIRECTORIES = ['src', 'scripts', '.github', 'build'];
const SCANNED_FILES = ['package.json', 'electron-builder.yml', 'electron-builder.windows-signed.yml', 'electron.vite.config.ts'];
const TEXT_FILE = /\.(?:[cm]?[jt]sx?|json|ya?ml|sh|ps1|cmd|bat|nsh|md)$/;
const TEST_FILE = /\.test\.[cm]?[jt]sx?$/;

describe('windowsStayInBackground', () => {
  it('keeps the windows of a build run from the checkout from taking the focus when an agent’s launch asks', () => {
    expect(windowsStayInBackground({ UVCS_BACKGROUND_WINDOWS: '1' }, false)).toBe(true);
  });

  it('never keeps an installed app’s windows back, whatever its environment holds', () => {
    expect(windowsStayInBackground({ UVCS_BACKGROUND_WINDOWS: '1' }, true)).toBe(false);
  });

  it('leaves them as always when nothing asks, or asks with anything but 1', () => {
    expect(windowsStayInBackground({}, false)).toBe(false);
    for (const value of ['', '0', 'true', 'yes']) expect(windowsStayInBackground({ UVCS_BACKGROUND_WINDOWS: value }, false)).toBe(false);
  });
});

describe('who keeps the windows in the background', () => {
  it('only the scripts agents run name UVCS_BACKGROUND_WINDOWS: no npm script, installer or launch a person uses', () => {
    const files = [...SCANNED_DIRECTORIES.flatMap((directory) => filesUnder(join(ROOT, directory), (name) => TEXT_FILE.test(name) && !TEST_FILE.test(name))), ...SCANNED_FILES.map((file) => join(ROOT, file))];
    const naming = files
      .filter((file) => readFileSync(file, 'utf8').includes('UVCS_BACKGROUND_WINDOWS'))
      .map((file) => relative(ROOT, file).split(sep).join('/'));
    expect(naming.filter((file) => !NAMES_IT.includes(file)).sort()).toEqual([...SETS_IT].sort());
  });
});
