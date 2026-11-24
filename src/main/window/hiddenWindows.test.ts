import { readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { filesUnder } from '@shared/testing/filesUnder';
import { windowsStayHidden } from './hiddenWindows';

const ROOT = join(__dirname, '..', '..', '..');
/** The smoke test's scripts, the only ones that run the app with its windows hidden. */
const SETS_IT = ['scripts/e2e/smoke.mjs', 'scripts/e2e/setupScreen.mjs'];
/** What only names the switch: its own module, and the docs that say what it does. Tests never launch the app. */
const NAMES_IT = ['src/main/window/hiddenWindows.ts', 'scripts/e2e/README.md'];
/** Where a launch could set it: the app's sources, the scripts, CI, the installers and the build's configuration. */
const SCANNED_DIRECTORIES = ['src', 'scripts', '.github', 'build'];
const SCANNED_FILES = ['package.json', 'electron-builder.yml', 'electron-builder.windows-signed.yml', 'electron.vite.config.ts'];
const TEXT_FILE = /\.(?:[cm]?[jt]sx?|json|ya?ml|sh|ps1|cmd|bat|nsh|md)$/;
const TEST_FILE = /\.test\.[cm]?[jt]sx?$/;

describe('windowsStayHidden', () => {
  it('hides the windows of a build run from the checkout that the smoke test asks to', () => {
    expect(windowsStayHidden({ UVCS_HIDDEN_WINDOWS: '1' }, false)).toBe(true);
  });

  it('never hides an installed app’s windows, whatever its environment holds', () => {
    expect(windowsStayHidden({ UVCS_HIDDEN_WINDOWS: '1' }, true)).toBe(false);
  });

  it('shows them when nothing asks, or asks with anything but 1', () => {
    expect(windowsStayHidden({}, false)).toBe(false);
    for (const value of ['', '0', 'true', 'yes']) expect(windowsStayHidden({ UVCS_HIDDEN_WINDOWS: value }, false)).toBe(false);
  });
});

describe('who hides the windows', () => {
  it('only the smoke test’s scripts name UVCS_HIDDEN_WINDOWS: no npm script, installer or launch a person uses', () => {
    const files = [...SCANNED_DIRECTORIES.flatMap((directory) => filesUnder(join(ROOT, directory), (name) => TEXT_FILE.test(name) && !TEST_FILE.test(name))), ...SCANNED_FILES.map((file) => join(ROOT, file))];
    const naming = files
      .filter((file) => readFileSync(file, 'utf8').includes('UVCS_HIDDEN_WINDOWS'))
      .map((file) => relative(ROOT, file).split(sep).join('/'));
    expect(naming.filter((file) => !NAMES_IT.includes(file)).sort()).toEqual([...SETS_IT].sort());
  });
});
