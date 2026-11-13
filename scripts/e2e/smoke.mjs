// `npm run e2e`: a light pass over the built app (run `npm run build` first), against the fake `cm` and a workspace
// in a temp folder (scripts/e2e/README.md). Opens the workspace, visits every view, a diff, a diff in a new window, a
// model diff, a branch's permissions, the command palette, a link pasted in it and Settings, switches the theme; fails on any renderer
// error, any `cm` command the fake doesn't know, or a view that doesn't show. It asserts only that things appear, never
// pixels or copy. Screenshots go to <tmp>/uvcs-e2e-shots/<checkout>-<hash>.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { _electron as electron } from 'playwright-core';
import { fakeCmExecutable } from './fakeCm/executable.mjs';
import { createWorkspace } from './workspaceFixture.mjs';

/** The sidebar's views by their accessible names, in its order (`VIEWS` in viewRegistry.ts): a new view is one line. */
const VIEWS = ['Changes', 'Incoming', 'Files', 'Branch Explorer', 'Changesets', 'Branches', 'Labels', 'Shelves', 'Attributes', 'Code reviews', 'Locks', 'Sync'];
/** Those a repository explored without a workspace shows (`showsView`): its Files are a branch's latest tree. */
const REPOSITORY_VIEWS = VIEWS.filter((view) => !['Changes', 'Incoming', 'Sync'].includes(view));
/** Long enough for a slow CI machine; waits end as soon as what they wait for shows. */
const TIMEOUT_MS = 15_000;
const VIEWPORT = { width: 1400, height: 880 };

const projectFolder = fileURLToPath(new URL('../..', import.meta.url));
const temp = mkdtempSync(join(tmpdir(), 'uvcs-e2e-'));
// One folder per checkout: runs in other worktrees at the same time (parallel agents) empty only their own.
const checkoutHash = createHash('sha1').update(projectFolder).digest('hex').slice(0, 8);
const shots = join(tmpdir(), 'uvcs-e2e-shots', `${basename(projectFolder)}-${checkoutHash}`);
rmSync(shots, { recursive: true, force: true });
mkdirSync(shots, { recursive: true });
const workspace = join(temp, 'demo');
const cmLog = join(temp, 'cm.log');
const userData = join(temp, 'user-data');
createWorkspace(workspace);
// Light theme to start with, and Gravatar as on a first run: pictures off until asked. The run answers "Not now", so
// nothing leaves the machine.
const settingsFile = join(userData, 'settings.json');
mkdirSync(userData);
writeFileSync(settingsFile, JSON.stringify({ theme: 'light' }));

const app = await electron.launch({
  args: ['.', `--user-data-dir=${userData}`],
  cwd: projectFolder,
  timeout: TIMEOUT_MS,
  env: {
    ...process.env,
    UVCS_CM_PATH: fakeCmExecutable(temp),
    UVCS_FAKE_WORKSPACE: workspace,
    UVCS_FAKE_CM_LOG: cmLog,
    // The official client's config folder, read by the first-run import (`plasticConfigFolder`): an empty one.
    PLASTIC_HOME: join(temp, 'plastic4'),
  },
});
const errors = [];
const window = await app.firstWindow();
window.setDefaultTimeout(TIMEOUT_MS);
window.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
window.on('console', (message) => message.type() === 'error' && errors.push(`console.error: ${message.text()}`));
const browserWindow = await app.browserWindow(window);
// The window's real size as well as the page's: a screenshot copies the real view (`capture`), which a frame's borders
// (Windows, a Linux desktop) or a small screen would otherwise leave smaller than the page laid out.
await browserWindow.evaluate((shown, size) => shown.setContentSize(size.width, size.height), VIEWPORT);
await window.setViewportSize(VIEWPORT);

const main = window.getByRole('main');
let shotNumber = 0;
/** Saves what the page shows, without needing the window drawn on screen (scripts/e2e/README.md). */
async function screenshot(name) {
  await withTimeout(capture(name), TIMEOUT_MS, `screenshot ${name}`);
}

async function capture(name) {
  await window.evaluate(() => new Promise((rendered) => requestAnimationFrame(() => requestAnimationFrame(() => rendered()))));
  const viewport = window.viewportSize();
  const png = await browserWindow.evaluate(async (shown, area) => (await shown.webContents.capturePage(area)).toPNG().toString('base64'), { x: 0, y: 0, ...viewport });
  writeFileSync(join(shots, `${String(++shotNumber).padStart(2, '0')}-${name}.png`), Buffer.from(png, 'base64'));
}

/** `promise`, or a failure naming `what` once `ms` pass: an `evaluate` has no timeout, and a wedged page never answers. */
async function withTimeout(promise, ms, what) {
  let timer;
  const expired = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${what}: no answer after ${ms} ms`)), ms);
  });
  try {
    return await Promise.race([promise, expired]);
  } finally {
    clearTimeout(timer);
  }
}

/** Waits until nothing in the page is loading (skeletons and spinners say `Loading`). */
async function settled() {
  await window.waitForFunction(() => !document.querySelector('main [aria-busy="true"], main [aria-label="Loading"]'));
}

async function step(name, run) {
  try {
    await run();
    await screenshot(name.toLowerCase().replaceAll(' ', '-'));
    console.log(`ok    ${name}`);
  } catch (error) {
    // Playwright's call log, under the message's first line, says what the step was doing when it gave up: a run that
    // fails now and then can be read only from its output.
    console.error(`FAIL  ${name}\n${error.message}`);
    await screenshot(`FAILED-${name.toLowerCase().replaceAll(' ', '-')}`).catch(() => {});
    throw new Error(`${name}: ${error.message.split('\n')[0]}`);
  }
}

const started = Date.now();
try {
  const workspaceOnHome = window.getByRole('region', { name: 'All workspaces' }).getByRole('button', { name: /^demo / });
  await step('Home', () => workspaceOnHome.waitFor());
  await step('The palette on the home screen', async () => {
    // No place is shown: it searches commands only, and nothing in it may ask for the window's place.
    await window.keyboard.press('ControlOrMeta+K');
    await window.getByRole('dialog').getByRole('combobox').waitFor();
    await window.keyboard.press('Escape');
    await window.getByRole('dialog').waitFor({ state: 'detached' });
  });
  await step("A Unity organization's projects", async () => {
    const sidebar = window.getByRole('navigation');
    await sidebar.getByRole('button', { name: /^studio/ }).click();
    await main.getByRole('heading', { level: 1, name: 'studio', exact: true }).waitFor();
    await main.getByRole('button', { name: 'Project: All projects' }).click();
    await window.getByPlaceholder('Find a project').fill('racing');
    await window.getByText('Racing', { exact: true }).first().waitFor();
    await window.keyboard.press('Enter');
    await main.getByRole('button', { name: 'Project: Racing' }).waitFor();
    // Inside its project, a repository goes by its own name; the other project's is filtered out.
    await main.getByText('Game', { exact: true }).waitFor();
    await main.getByText('Levels', { exact: true }).waitFor({ state: 'detached' });
    // A deleted repository shows only once asked for, tagged, with Restore.
    await main.getByText('Old', { exact: true }).waitFor({ state: 'detached' });
    await main.getByRole('button', { name: 'Deleted', exact: true }).click();
    await main.getByText('Old', { exact: true }).waitFor();
    await main.getByRole('button', { name: 'Restore' }).waitFor();
    await main.getByRole('button', { name: 'Deleted', exact: true }).click();
    await sidebar.getByRole('button', { name: /^Home/ }).click();
    await workspaceOnHome.waitFor();
  });
  await step('Open workspace', async () => {
    await workspaceOnHome.click();
    await window.getByRole('navigation').getByRole('button', { name: 'Switch workspace' }).waitFor();
  });
  await step('Profile pictures question', async () => {
    // Changesets show their owners, named by email addresses: the first people the window shows.
    await window.getByRole('navigation').getByRole('button', { name: /^Changesets( \d+)?$/ }).click();
    const question = window.getByRole('alert').filter({ hasText: 'Show profile pictures?' });
    await question.getByRole('button', { name: 'Not now' }).click();
    await question.waitFor({ state: 'detached' });
  });
  for (const view of VIEWS) {
    await step(view, async () => {
      // A view's button may carry a count (`Changes 2`).
      await window.getByRole('navigation').getByRole('button', { name: new RegExp(`^${view}( \\d+)?$`) }).click();
      await main.getByRole('heading', { level: 1, name: view, exact: true }).waitFor();
      await settled();
    });
  }
  await step("A code review's conversation", async () => {
    await window.getByRole('navigation').getByRole('button', { name: /^Code reviews( \d+)?$/ }).click();
    await main.getByText('Review player movement', { exact: true }).dblclick();
    await main.getByRole('tab', { name: /^Conversation/ }).waitFor();
    await main.getByText('Jump only when grounded.').first().waitFor();
    await main.getByText("You get emails because you're a reviewer.").waitFor();
    await settled();
  });
  await step('Branch Explorer timeline', async () => {
    // From another view its shortcut opens the Branch Explorer with the timeline shown.
    await window.keyboard.press(process.platform === 'darwin' ? 'Meta+Alt+T' : 'Alt+Shift+T');
    await main.getByRole('heading', { level: 1, name: 'Branch Explorer', exact: true }).waitFor();
    await main.getByRole('img', { name: 'Timeline' }).waitFor();
    await main.getByRole('img', { name: 'Timeline' }).click();
    await main.getByRole('button', { name: 'Hide timeline' }).click();
    await main.getByRole('img', { name: 'Timeline' }).waitFor({ state: 'detached' });
  });
  await step('Diff', async () => {
    await window.getByRole('navigation').getByRole('button', { name: /^Changes( \d+)?$/ }).click();
    await main.getByText('src/player.cs', { exact: true }).first().click();
    // A line only the edited side of the fixture's file has.
    await main.getByText('void Jump() { }').first().waitFor();
  });
  await step("The branch's change requests to apply", async () => {
    // The workspace's branch has a review asking for a change: the description offers it, and picking it writes it.
    await main.getByRole('button', { name: '1 change request to apply' }).click();
    await window.getByRole('listbox', { name: 'Suggestions' }).getByRole('option', { name: /Jump only when grounded/ }).click();
    await main.getByLabel('Applies change request: Jump only when grounded.').waitFor();
    await main.getByRole('button', { name: '1 change request to apply' }).waitFor({ state: 'detached' });
  });
  await step('Expanded diff', async () => {
    // The header's button, then the key: the sidebar goes out of sight and the diff stays; Esc gives the window back.
    const sidebar = window.getByRole('navigation');
    await main.getByRole('button', { name: 'Expand diff' }).click();
    await sidebar.waitFor({ state: 'hidden' });
    await main.getByText('void Jump() { }').first().waitFor();
    await window.keyboard.press('Escape');
    await sidebar.waitFor();
    await window.keyboard.press('ControlOrMeta+Shift+E');
    await sidebar.waitFor({ state: 'hidden' });
    await main.getByRole('button', { name: 'Expand diff', pressed: true }).click();
    await sidebar.waitFor();
  });
  await step('A revision read from the disk', async () => {
    await window.getByRole('navigation').getByRole('button', { name: /^Files( \d+)?$/ }).click();
    await main.getByText('README.md', { exact: true }).first().click();
    // The fake cm's revision 201 is another file's: README.md's text shows only when its revision is read from disk.
    await main.getByText('A small game.').first().waitFor();
    // A last change against its parent: the side after from the disk, the side before (revision 200) downloaded.
    // Go to file reveals it without selecting its folder (whose details the fake cm doesn't know).
    await window.keyboard.press('ControlOrMeta+P');
    // Enter picks only a result shown: the workspace's paths are read when the dialog first opens, slowly on CI.
    const goToFile = window.getByRole('dialog', { name: 'Go to file' });
    await goToFile.locator('input').fill('camera');
    await goToFile.getByText('camera.cs', { exact: false }).first().waitFor();
    await window.keyboard.press('Enter');
    await main.getByText('float distance = 8f;').first().waitFor();
    await main.getByText('float distance = 10f;').first().waitFor();
    await window.getByRole('navigation').getByRole('button', { name: /^Changes( \d+)?$/ }).click();
  });
  await step('Model diff', async () => {
    await main.getByText('Assets/crate.obj', { exact: true }).first().click();
    // The 3D view, and what changed in it: the fixture renamed the crate's material slot.
    await main.getByLabel('3D view of the model').waitFor();
    await main.getByRole('region', { name: 'What changed' }).waitFor();
  });
  await step('The .meta of a binary file', async () => {
    await main.getByText('Assets/hurt.wav', { exact: true }).first().click();
    await main.getByText('Binary file', { exact: true }).waitFor();
    await main.getByRole('button', { name: '.meta', exact: true }).click();
    await main.getByText('loadInBackground: 1').first().waitFor();
  });
  await step('A diff in a new window', async () => {
    await window.getByRole('navigation').getByRole('button', { name: /^Changesets( \d+)?$/ }).click();
    await main.getByRole('button', { name: 'Open diff' }).click();
    const opened = app.waitForEvent('window');
    await main.getByRole('button', { name: 'Open in new window' }).click();
    const pageWindow = await opened;
    pageWindow.on('pageerror', (error) => errors.push(`page window pageerror: ${error.message}`));
    pageWindow.on('console', (message) => message.type() === 'error' && errors.push(`page window console.error: ${message.text()}`));
    // The diff moved: its window shows it, with its one option, and this window is back on the list.
    await pageWindow.getByRole('button', { name: 'Follow selection' }).waitFor({ timeout: TIMEOUT_MS });
    await pageWindow.getByText('src/player.cs', { exact: true }).first().waitFor({ timeout: TIMEOUT_MS });
    await main.getByRole('heading', { level: 1, name: 'Changesets', exact: true }).waitFor();
    await pageWindow.close();
  });
  await step('Permissions', async () => {
    await window.getByRole('navigation').getByRole('button', { name: /^Branches( \d+)?$/ }).click();
    await main.getByRole('button', { name: 'More actions' }).click();
    await window.getByRole('menuitem', { name: 'Permissions…' }).click();
    const dialog = window.getByRole('dialog', { name: 'Permissions' });
    await dialog.getByRole('option', { name: /^Developers/ }).click();
    const checkIn = dialog.getByRole('row', { name: /^Check in/ });
    await checkIn.click();
    await window.keyboard.press('d');
    await dialog.getByRole('button', { name: '1 change' }).waitFor();
    await checkIn.locator('[data-saved="true"]').waitFor();
    await window.keyboard.press('Shift+F10');
    await window.getByRole('menuitem', { name: 'Ignore allows from above' }).waitFor();
    await window.keyboard.press('Escape');
    await window.getByRole('menu').waitFor({ state: 'detached' });
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await window.getByRole('dialog', { name: 'Discard 1 change?' }).getByRole('button', { name: 'Discard' }).click();
    await dialog.waitFor({ state: 'detached' });
  });
  await step('Command palette', async () => {
    await window.keyboard.press('ControlOrMeta+K');
    await window.getByRole('dialog').getByRole('combobox').waitFor();
  });
  await step('A prefix in the palette', async () => {
    // `@` narrows it to people: the owners of what it read, with no command of its own.
    const palette = window.getByRole('dialog');
    await window.keyboard.type('@');
    await palette.getByRole('group', { name: 'People' }).getByRole('option').first().waitFor();
    await palette.getByRole('combobox').fill('');
  });
  await step("A code review's number in the palette", async () => {
    // A number alone names a review too, first when it's past every changeset (the fake's reach changeset 7).
    const palette = window.getByRole('dialog');
    await window.keyboard.type('80');
    await palette.getByRole('option').first().filter({ hasText: 'Review player movement' }).waitFor();
    await palette.getByRole('combobox').fill('');
  });
  await step('A link pasted in the palette', async () => {
    // The official client's shape, as people paste what they were sent: it opens the changeset's diff.
    await window.keyboard.type('plastic://local/repos/demo/changesets/3/diff');
    await window.getByRole('dialog').getByRole('option', { name: /^Changeset 3/ }).click();
    await main.getByText('src/player.cs', { exact: true }).first().waitFor();
    await main.getByRole('button', { name: /^Copy link/ }).waitFor();
    await window.keyboard.press('ControlOrMeta+K');
    await window.getByRole('dialog').getByRole('combobox').waitFor();
  });
  await step('Explore a repository', async () => {
    await window.keyboard.press('Escape');
    await window.getByRole('dialog').waitFor({ state: 'detached' });
    await window.getByRole('button', { name: 'Home' }).first().click();
    await window.getByRole('navigation').getByRole('button', { name: /^This computer/ }).click();
    await window.getByRole('button', { name: 'Repository actions' }).first().click();
    await window.getByRole('menuitem', { name: 'Explore', exact: true }).click();
    await main.getByRole('heading', { level: 1, name: 'Branch Explorer', exact: true }).waitFor();
    await window.getByRole('button', { name: 'Create workspace' }).waitFor();
  });
  for (const view of REPOSITORY_VIEWS) {
    await step(`${view} of a repository`, async () => {
      await window.getByRole('navigation').getByRole('button', { name: new RegExp(`^${view}( \\d+)?$`) }).click();
      await main.getByRole('heading', { level: 1, name: view, exact: true }).waitFor();
      await settled();
    });
  }
  await step("A repository's file found by name", async () => {
    await window.getByRole('navigation').getByRole('button', { name: /^Files/ }).click();
    await main.getByPlaceholder('Find files and folders by name').fill('player');
    await main.getByRole('button', { name: /player\.cs/ }).first().click();
    await main.getByRole('row', { name: /player\.cs/ }).first().waitFor();
  });
  await step("A repository's changeset diff, in a new window too", async () => {
    await window.getByRole('navigation').getByRole('button', { name: /^Changesets/ }).click();
    await main.getByRole('button', { name: 'Open diff' }).click();
    await main.getByText('src/player.cs', { exact: true }).first().waitFor();
    const opened = app.waitForEvent('window');
    await main.getByRole('button', { name: 'Open in new window' }).click();
    const pageWindow = await opened;
    pageWindow.on('pageerror', (error) => errors.push(`repository page window pageerror: ${error.message}`));
    pageWindow.on('console', (message) => message.type() === 'error' && errors.push(`repository page window console.error: ${message.text()}`));
    await pageWindow.getByText('src/player.cs', { exact: true }).first().waitFor({ timeout: TIMEOUT_MS });
    await pageWindow.close();
    await window.keyboard.press('ControlOrMeta+K');
    await window.getByRole('dialog').getByRole('combobox').waitFor();
  });
  await step('Settings and dark theme', async () => {
    await window.keyboard.press('Escape');
    await window.getByRole('dialog').waitFor({ state: 'detached' });
    await window.getByRole('navigation').getByRole('button', { name: 'Settings' }).click();
    await window.getByRole('dialog', { name: 'Settings' }).getByRole('radio', { name: /^Dark/ }).click();
    await window.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
  });
  await step('Settings › Issue tracker, with none connected', async () => {
    // Its empty state reads only the app's own file: no tracker is reached, and no keychain is asked.
    const settings = window.getByRole('dialog', { name: 'Settings' });
    await settings.getByRole('button', { name: 'Issue tracker' }).click();
    await settings.getByText('No sign-ins yet').waitFor({ timeout: TIMEOUT_MS });
    await settings.getByRole('button', { name: 'Add a sign-in' }).waitFor({ timeout: TIMEOUT_MS });
  });
} catch (error) {
  errors.push(error.message);
} finally {
  await app.close();
}

// "Not now" was saved as the user's answer, so the app never asks again. Checked only after a clean run: a step that
// failed already says what went wrong.
const savedSettings = existsSync(settingsFile) ? JSON.parse(readFileSync(settingsFile, 'utf8')) : {};
if (errors.length === 0 && (savedSettings.showGravatar !== false || savedSettings.gravatarChoiceAsked !== true)) {
  errors.push(`"Not now" wasn't saved: showGravatar ${savedSettings.showGravatar}, gravatarChoiceAsked ${savedSettings.gravatarChoiceAsked}`);
}

// Every command the fake couldn't answer, its `--format` separators made visible.
const failedCommands = existsSync(cmLog) ? readFileSync(cmLog, 'utf8').split('\n').filter((line) => line.startsWith('ERR')) : [];
errors.push(...failedCommands.map((line) => `the fake cm failed: ${line.slice(4).replace(/[\u001e\u001f]/g, '|')} (teach it: scripts/e2e/README.md)`));
console.log(`\n${VIEWS.length} views in ${((Date.now() - started) / 1000).toFixed(1)} s; screenshots in ${shots}`);
// Windows may hold cm.exe a moment after the app quits.
rmSync(temp, { recursive: true, force: true, maxRetries: 5 });
if (errors.length > 0) {
  console.error(`\nFAILED:\n${errors.map((error) => `  ${error}`).join('\n')}`);
  process.exit(1);
}
console.log('Smoke test passed.');
