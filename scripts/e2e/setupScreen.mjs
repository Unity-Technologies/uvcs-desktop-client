// Part of `npm run e2e`, after the smoke test: the screens that stand in for the app while its `cm` can't run yet
// (docs/features/cm-runtime.md). Each launch has an empty store in a temp folder, a download site answering 404 to every
// bundle, and the fake `cm` as the one "installed on this computer" (on the PATH).
//
// 1. The setup screen: the app's own chosen in Settings, so it sets that up. It checks the window starts on the setup
//    screen and nothing asks `cm` for anything but its version meanwhile, then that "Use the installed one" brings the
//    app to Home on it, and saves that choice. The pin can't be met without the real bundles, so the download
//    itself is never tested here: the unit tests cover it.
// 2. The update screen: the default choice, with the installed `cm` older than the app needs
//    (`UVCS_FAKE_CM_VERSION_FILE`). It checks the update screen shows, then that checking again (Check Again on Linux,
//    the window gaining focus elsewhere), once the "installed" one is the pinned version, brings the app to Home on it.
// 3. Updating the installed one: the update screen with a fake of the download site (`fakeOfficialSite.mjs`) and the
//    development build's fake installer (`UVCS_FAKE_OFFICIAL_UPDATE`), which only writes the version the fake `cm`
//    prints. Update brings the app to Home once it "installed"; a declined permission says it couldn't. On Linux, which
//    has no installer, the screen shows the command instead.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { _electron as electron } from 'playwright-core';
import { fakeCmExecutable } from './fakeCm/executable.mjs';
import { startFakeOfficialSite } from './fakeOfficialSite.mjs';
import { createWorkspace } from './workspaceFixture.mjs';

const TIMEOUT_MS = 15_000;
const projectFolder = fileURLToPath(new URL('../..', import.meta.url));
const { version: PINNED_CM_VERSION } = JSON.parse(readFileSync(join(projectFolder, 'cm-version.json'), 'utf8'));
const temp = mkdtempSync(join(tmpdir(), 'uvcs-e2e-setup-'));
const workspace = join(temp, 'demo');
createWorkspace(workspace);

// The fake `cm` as an installed one: `cm` (`cm.exe` on Windows) in a folder on the PATH.
const bin = join(temp, 'bin');
mkdirSync(bin);
const fake = fakeCmExecutable(temp);
if (process.platform !== 'win32') symlinkSync(fake, join(bin, 'cm'));
const pathFolders = process.platform === 'win32' ? dirname(fake) : bin;

// A download site that has no bundle at all.
const site = createServer((_request, response) => response.writeHead(404).end());
await new Promise((listening) => site.listen(0, '127.0.0.1', listening));

// The site the installed one's update comes from, offering a version past the pinned one.
const UPDATE_VERSION = PINNED_CM_VERSION.replace(/\d+$/, (build) => String(Number(build) + 35));
const officialSite = await startFakeOfficialSite({ latest: UPDATE_VERSION, size: 64 * 1024 });

const errors = [];
try {
  await setupScreen();
  await updateScreen();
  await officialUpdate();
} finally {
  site.close();
  officialSite.close();
  rmSync(temp, { recursive: true, force: true, maxRetries: 5 });
}
if (errors.length > 0) {
  console.error(`\nFAILED:\n${errors.map((error) => `  ${error}`).join('\n')}`);
  process.exit(1);
}
console.log('Setup and update screen tests passed.');

async function setupScreen() {
  const run = await launch('setup', { cmChoice: 'managed', cmDeclinedUpdateFor: null });
  await run.steps(async (window) => {
    await window.getByRole('heading', { name: /couldn.t be set up/ }).waitFor();
    console.log('ok    The setup screen, its download failed');
    const asked = run.commandsRun().filter((line) => !/^ok\s+version\b/.test(line));
    if (asked.length > 0) errors.push(`cm was asked for more than its version during the setup: ${asked.join(', ')}`);

    await window.getByRole('button', { name: /^Use the installed one/ }).click();
    await window.getByRole('region', { name: 'All workspaces' }).waitFor();
    console.log('ok    Home, on the installed cm');
  });
  const saved = run.savedSettings();
  if (saved.cmChoice !== 'installed') errors.push(`the choice wasn't saved: cmChoice ${saved.cmChoice}`);
}

async function updateScreen() {
  const run = await launch('update', {}, {}, '11.0.16.1');
  await run.steps(async (window) => {
    await window.getByRole('heading', { name: 'Update Unity Version Control' }).waitFor();
    console.log('ok    The update screen, the installed cm older than the app needs');

    writeFileSync(run.versionFile, PINNED_CM_VERSION);
    // Check Again shows on Linux; elsewhere, the window checks again as it gains focus.
    if (process.platform === 'linux') await window.getByRole('button', { name: 'Check Again' }).click();
    else await window.evaluate(() => window.dispatchEvent(new Event('focus')));
    await window.getByRole('region', { name: 'All workspaces' }).waitFor();
    console.log('ok    Home, on the installed cm once it was updated');
  });
}

async function officialUpdate() {
  if (process.platform === 'linux') {
    const run = await launch('update-linux', {}, {}, '11.0.16.1');
    await run.steps(async (window) => {
      await window.getByText(/apt-get install --only-upgrade|dnf upgrade|zypper update/).waitFor();
      console.log('ok    The update screen on Linux, with the command that updates it');
    });
    return;
  }
  const installs = await launch('official-update', {}, { UVCS_FAKE_OFFICIAL_UPDATE: 'installs' }, '11.0.16.1');
  await installs.steps(async (window) => {
    await window.getByText('The update is ready to install.').waitFor();
    console.log('ok    The update screen, its update downloaded in the background');
    await window.getByRole('button', { name: 'Update', exact: true }).click();
    await window.getByRole('region', { name: 'All workspaces' }).waitFor();
    console.log('ok    Home, on the installed cm once Update installed it');
  });
  const declined = await launch('official-update-declined', {}, { UVCS_FAKE_OFFICIAL_UPDATE: 'declined' }, '11.0.16.1');
  await declined.steps(async (window) => {
    await window.getByRole('button', { name: 'Update', exact: true }).click();
    await window.getByRole('heading', { name: 'Couldn’t update Unity Version Control' }).waitFor();
    console.log('ok    The update screen says it couldn’t update when the permission was declined');
  });
}

/**
 * Launches the app over its own user data, store and fake `cm` log, named `name`, with these settings saved, and the
 * fake `cm` printing `cmVersion` (the pinned one when none), written before the app's first `cm version` asks.
 */
async function launch(name, settings, extraEnv = {}, cmVersion = null) {
  const folder = join(temp, name);
  const userData = join(folder, 'user-data');
  const cmLog = join(folder, 'cm.log');
  const versionFile = join(folder, 'cm-version');
  mkdirSync(userData, { recursive: true });
  // `cm` runs in the home folder when nothing names another (`CmClient`), so it must be there.
  mkdirSync(join(folder, 'home'));
  writeFileSync(join(userData, 'settings.json'), JSON.stringify({ theme: 'light', ...settings }));
  if (cmVersion) writeFileSync(versionFile, cmVersion);
  const app = await electron.launch({
    args: ['.', `--user-data-dir=${userData}`],
    cwd: projectFolder,
    timeout: TIMEOUT_MS,
    env: {
      ...Object.fromEntries(Object.entries(process.env).filter(([variable]) => variable !== 'UVCS_CM_PATH')),
      // An empty store, wherever this OS keeps it (`cmStoreFolder`), and the installed one's update beside it.
      HOME: join(folder, 'home'),
      LOCALAPPDATA: join(folder, 'local'),
      XDG_DATA_HOME: join(folder, 'data'),
      PATH: `${pathFolders}${delimiter}${dirname(process.execPath)}${delimiter}${process.env.PATH ?? ''}`,
      UVCS_CM_BUNDLES_URL: `http://127.0.0.1:${site.address().port}/bundles`,
      UVCS_FAKE_WORKSPACE: workspace,
      UVCS_FAKE_CM_LOG: cmLog,
      UVCS_FAKE_CM_SIGN_IN: join(folder, 'sign-in'),
      UVCS_FAKE_CM_VERSION_FILE: versionFile,
      PLASTIC_HOME: join(folder, 'plastic4'),
      UVCS_OFFICIAL_UPDATES_URL: officialSite.url,
      UVCS_FAKE_OFFICIAL_UPDATE_MS: '200',
      ...extraEnv,
    },
  });
  return {
    versionFile,
    /** Runs the steps on the first window, failing on renderer errors, and closes the app. */
    async steps(run) {
      try {
        const window = await app.firstWindow();
        window.setDefaultTimeout(TIMEOUT_MS);
        window.on('pageerror', (error) => errors.push(`${name}: pageerror: ${error.message}`));
        window.on('console', (message) => message.type() === 'error' && errors.push(`${name}: console.error: ${message.text()}`));
        await run(window);
      } catch (error) {
        errors.push(`${name}: ${error.message.split('\n')[0]}`);
      } finally {
        await app.close();
      }
    },
    /** The commands the fake `cm` ran so far, as logged (`ok version`). */
    commandsRun: () => (existsSync(cmLog) ? readFileSync(cmLog, 'utf8').split('\n').filter(Boolean) : []),
    savedSettings: () => JSON.parse(readFileSync(join(userData, 'settings.json'), 'utf8')),
  };
}
