// Part of `npm run e2e`, after the smoke test: the app's first run with no `cm` of its own (docs/features/cm-runtime.md).
// The store is an empty temp folder, the download site answers 404 to every bundle, and the fake `cm` is the one
// "installed on this computer" (on the PATH). It checks the window starts on the setup screen and nothing asks `cm`
// for anything but its version meanwhile, then that "Use the installed one" brings the app to Home on it. The pin
// can't be met without the real bundles, so the download itself is never tested here: the unit tests cover it.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { _electron as electron } from 'playwright-core';
import { fakeCmExecutable } from './fakeCm/executable.mjs';
import { createWorkspace } from './workspaceFixture.mjs';

const TIMEOUT_MS = 15_000;
const projectFolder = fileURLToPath(new URL('../..', import.meta.url));
const temp = mkdtempSync(join(tmpdir(), 'uvcs-e2e-setup-'));
const cmLog = join(temp, 'cm.log');
const userData = join(temp, 'user-data');
const workspace = join(temp, 'demo');
createWorkspace(workspace);
mkdirSync(userData);
writeFileSync(join(userData, 'settings.json'), JSON.stringify({ theme: 'light' }));

// The fake `cm` as an installed one: `cm` (`cm.exe` on Windows) in a folder on the PATH.
const bin = join(temp, 'bin');
mkdirSync(bin);
const fake = fakeCmExecutable(temp);
if (process.platform !== 'win32') symlinkSync(fake, join(bin, 'cm'));
const pathFolders = process.platform === 'win32' ? dirname(fake) : bin;

// A download site that has no bundle at all.
const site = createServer((_request, response) => response.writeHead(404).end());
await new Promise((listening) => site.listen(0, '127.0.0.1', listening));

const errors = [];
const app = await electron.launch({
  args: ['.', `--user-data-dir=${userData}`],
  cwd: projectFolder,
  timeout: TIMEOUT_MS,
  env: {
    ...Object.fromEntries(Object.entries(process.env).filter(([name]) => name !== 'UVCS_CM_PATH')),
    // An empty store, wherever this OS keeps it (`cmStoreFolder`).
    HOME: join(temp, 'home'),
    LOCALAPPDATA: join(temp, 'local'),
    XDG_DATA_HOME: join(temp, 'data'),
    PATH: `${pathFolders}${delimiter}${dirname(process.execPath)}${delimiter}${process.env.PATH ?? ''}`,
    UVCS_CM_BUNDLES_URL: `http://127.0.0.1:${site.address().port}/bundles`,
    UVCS_FAKE_WORKSPACE: workspace,
    UVCS_FAKE_CM_LOG: cmLog,
    UVCS_FAKE_CM_SIGN_IN: join(temp, 'sign-in'),
    PLASTIC_HOME: join(temp, 'plastic4'),
  },
});
try {
  const window = await app.firstWindow();
  window.setDefaultTimeout(TIMEOUT_MS);
  window.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  window.on('console', (message) => message.type() === 'error' && errors.push(`console.error: ${message.text()}`));

  await window.getByRole('heading', { name: /couldn.t be set up/ }).waitFor();
  console.log('ok    The setup screen, its download failed');
  const asked = commandsRun().filter((line) => !/^ok\s+version\b/.test(line));
  if (asked.length > 0) errors.push(`cm was asked for more than its version during the setup: ${asked.join(', ')}`);

  await window.getByRole('button', { name: /^Use the installed one/ }).click();
  await window.getByRole('region', { name: 'All workspaces' }).waitFor();
  console.log('ok    Home, on the installed cm');
} catch (error) {
  errors.push(error.message.split('\n')[0]);
} finally {
  await app.close();
  site.close();
}

const saved = JSON.parse(readFileSync(join(userData, 'settings.json'), 'utf8'));
if (errors.length === 0 && saved.cmChoice !== 'installed') errors.push(`the choice wasn't saved: cmChoice ${saved.cmChoice}`);
rmSync(temp, { recursive: true, force: true, maxRetries: 5 });
if (errors.length > 0) {
  console.error(`\nFAILED:\n${errors.map((error) => `  ${error}`).join('\n')}`);
  process.exit(1);
}
console.log('Setup screen test passed.');

/** The commands the fake `cm` ran so far, as logged (`ok version`). */
function commandsRun() {
  return existsSync(cmLog) ? readFileSync(cmLog, 'utf8').split('\n').filter(Boolean) : [];
}
