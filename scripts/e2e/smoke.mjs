// `npm run e2e`: a light pass over the built app (run `npm run build` first), against the fake `cm` and a workspace
// in a temp folder (scripts/e2e/README.md). Opens the workspace, visits every view, a diff, a diff in a new window, a
// model diff, a branch's permissions, the command palette, a link pasted in it and Settings, switches the theme; fails on any renderer
// error, any `cm` command the fake doesn't know, or a view that doesn't show. It asserts only that things appear, never
// pixels or copy. Screenshots go to <tmp>/uvcs-e2e-shots/<checkout>-<hash>, or `UVCS_E2E_SHOTS`/<checkout>-<hash>.
// A step earns its place only for what unit tests can't reach (scripts/e2e/README.md "What belongs here").
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { _electron as electron } from 'playwright-core';
import { fakeCmExecutable } from './fakeCm/executable.mjs';
import { createWorkspace } from './workspaceFixture.mjs';

/** The sidebar's views by their accessible names, in its order (`VIEWS` in viewRegistry.ts): a new view is one line. */
const VIEWS = ['Changes', 'Incoming', 'Files', 'Branch Explorer', 'Changesets', 'Branches', 'Labels', 'Shelves', 'Attributes', 'Merge requests', 'Locks', 'Sync'];
/** Those a repository explored without a workspace shows (`showsView`): its Files are a branch's latest tree. */
const REPOSITORY_VIEWS = VIEWS.filter((view) => !['Changes', 'Incoming', 'Sync'].includes(view));
/** Long enough for a slow CI machine; waits end as soon as what they wait for shows. */
const TIMEOUT_MS = 15_000;
const VIEWPORT = { width: 1400, height: 880 };
/**
 * A screenshot of every step locally, for a person or an agent to look at; on CI only the failed step's, the only one
 * the job keeps (its artifact is uploaded when it fails): taking each costs about a tenth of the run.
 */
const SHOTS_OF_EVERY_STEP = process.env.CI !== 'true';

const projectFolder = fileURLToPath(new URL('../..', import.meta.url));
const temp = mkdtempSync(join(tmpdir(), 'uvcs-e2e-'));
// One folder per checkout, emptied as a run starts: runs in other worktrees at the same time (parallel agents) empty
// only their own. It sits in `UVCS_E2E_SHOTS` when set (CI's, kept when the run fails), never emptied itself.
const checkoutHash = createHash('sha1').update(projectFolder).digest('hex').slice(0, 8);
const shotsParent = process.env.UVCS_E2E_SHOTS || join(tmpdir(), 'uvcs-e2e-shots');
const shots = join(shotsParent, `${basename(projectFolder)}-${checkoutHash}`);
rmSync(shots, { recursive: true, force: true });
mkdirSync(shots, { recursive: true });
const workspace = join(temp, 'demo');
const cmLog = join(temp, 'cm.log');
// Holds the server whose session ended, while one has (`fakeCm/signIn.cjs`): none to start with.
const signInFile = join(temp, 'sign-in');
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
    UVCS_FAKE_CM_SIGN_IN: signInFile,
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

/** The commands the fake `cm` ran so far, as logged (`ok find branch …`). */
function commandsRun() {
  return existsSync(cmLog) ? readFileSync(cmLog, 'utf8').split('\n').filter(Boolean) : [];
}

/**
 * Commands that need no sign-in (`needsSignIn` in main/cm/repeatedCommands.ts): those that only read this machine, and
 * a `cm status` told not to work out the workspace's header, which would ask the server for its branch's head.
 */
const LOCAL_COMMAND = /^(ok |ERR) ((getworkspacefrompath|wi|profile|version|changelist|workspace list)\b|status\b.* (--compact|--cset|--format)\b)/;

// `checkVisibility()` (`settled`) takes an element laid out with `display: contents` for hidden: no loader may use it.
const LOADING = 'main [aria-busy="true"], main [aria-label="Loading"]';

/**
 * Waits until nothing shown is loading (skeletons and spinners say `Loading`). Only what shows: a view left while it
 * loaded stays mounted, hidden by its `Activity` (`MOUNTED_VIEWS`), with its effects stopped, so it shows its skeleton
 * until it is shown again and reads its data then. If something still is when the wait gives up, the failure names it
 * (`stillLoading`): a run that fails now and then can be read only from its output.
 */
async function settled() {
  try {
    await window.waitForFunction((loading) => ![...document.querySelectorAll(loading)].some((element) => element.checkVisibility()), LOADING);
  } catch (error) {
    const loading = await withTimeout(window.evaluate(stillLoading, LOADING), TIMEOUT_MS, 'what is still loading').catch((reason) => [reason.message]);
    throw new Error(`${error.message.split('\n')[0]}\nStill loading:\n  ${loading.join('\n  ')}`, { cause: error });
  }
}

/**
 * Runs in the page: each element still loading, as its tag, role, label and whether it is shown, with the nearest
 * landmark and heading around it, so a failure says which view (shown, or kept hidden in an `Activity`) waits on what.
 */
function stillLoading(loading) {
  const describe = (element) => {
    const attributes = ['role', 'aria-label', 'aria-busy', 'class'].map((name) => element.getAttribute(name) && `${name}="${element.getAttribute(name)}"`);
    return `<${element.tagName.toLowerCase()} ${attributes.filter(Boolean).join(' ')}>`;
  };
  const headingAround = (element) => {
    for (let node = element; node; node = node.parentElement) {
      const heading = node.querySelector('h1, h2, h3, [role="heading"]');
      if (heading) return heading.textContent.trim().slice(0, 60);
    }
    return '(no heading)';
  };
  return [...document.querySelectorAll(loading)].map((element) => {
    const region = element.closest('aside, section, [role="region"], [role="dialog"], main');
    const shown = element.checkVisibility() ? 'shown' : 'hidden';
    return `${describe(element)} ${shown}, in ${region ? describe(region) : '(no region)'} under "${headingAround(element)}"`;
  });
}

async function step(name, run) {
  try {
    await run();
    if (SHOTS_OF_EVERY_STEP) await screenshot(name.toLowerCase().replaceAll(' ', '-'));
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
  await step("A Unity organization's page", async () => {
    const sidebar = window.getByRole('navigation');
    await sidebar.getByRole('button', { name: /^studio/ }).click();
    await main.getByRole('heading', { level: 1, name: 'studio', exact: true }).waitFor();
    await settled();
    await sidebar.getByRole('button', { name: /^Home/ }).click();
    await workspaceOnHome.waitFor();
  });
  await step('Open workspace', async () => {
    await workspaceOnHome.click();
    await window.getByRole('banner').getByRole('button', { name: 'Switch workspace' }).waitFor();
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
  await step("A merge request's conversation", async () => {
    await window.getByRole('navigation').getByRole('button', { name: /^Merge requests( \d+)?$/ }).click();
    // The row's title: the details panel names the selected row too.
    await main.getByRole('row').getByText('Review player movement', { exact: true }).dblclick();
    await main.getByRole('tab', { name: /^Conversation/ }).waitFor();
    await settled();
  });
  await step('The larger comment editor over the page', async () => {
    // Its button, from the new comment's field: the panel must be what a press at its middle reaches, never the dimmed
    // backdrop over it (a stacking context around the views once kept the panel under it).
    const field = main.locator('[data-comment-field]').filter({ has: window.getByRole('textbox', { name: 'New comment' }) });
    await field.getByRole('textbox').click();
    await field.getByRole('button', { name: 'Write in a larger editor' }).click();
    const panel = window.locator('[data-open="overlay"]');
    await panel.waitFor();
    const onTop = await panel.evaluate((element) => {
      const box = element.getBoundingClientRect();
      return element.contains(document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2));
    });
    if (!onTop) throw new Error('The larger editor is under its backdrop: a press on it reaches something else');
    await window.keyboard.press('Escape');
    await panel.waitFor({ state: 'detached' });
  });
  await step("A merge the server's merge rules refuse", async () => {
    // The fake's server merges only reviewed branches: the merge page says so and opens the request back.
    await main.getByRole('button', { name: 'Merge into main…' }).click();
    await main.getByText('This server merges into main only reviewed branches').waitFor();
    await main.getByRole('button', { name: 'Open merge request' }).click();
    await main.getByRole('tab', { name: /^Conversation/ }).waitFor();
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
  await step('Model diff', async () => {
    await main.getByText('Assets/crate.obj', { exact: true }).first().click();
    // The 3D view, and what changed in it: the fixture renamed the crate's material slot.
    await main.getByLabel('3D view of the model').waitFor();
    await main.getByRole('region', { name: 'What changed' }).waitFor();
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
    await dialog.getByRole('row', { name: /^Check in/ }).waitFor();
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await dialog.waitFor({ state: 'detached' });
  });
  await step('Command palette', async () => {
    await window.keyboard.press('ControlOrMeta+K');
    await window.getByRole('dialog').getByRole('combobox').waitFor();
  });
  await step('A link pasted in the palette', async () => {
    // The official client's shape, as people paste what they were sent: it opens the changeset's diff.
    await window.keyboard.type('plastic://local/repos/demo/changesets/3/diff');
    await window.getByRole('dialog').getByRole('option', { name: /^Changeset 3/ }).click();
    // Visible only: the views shown lately stay mounted, hidden, and may list the same file (`mountedViews`).
    await main.getByText('src/player.cs', { exact: true }).filter({ visible: true }).first().waitFor();
    await main.getByRole('button', { name: /^Copy link/ }).waitFor();
    await window.keyboard.press('ControlOrMeta+K');
    await window.getByRole('dialog').getByRole('combobox').waitFor();
  });
  await step('A session that ended', async () => {
    await window.keyboard.press('Escape');
    await window.getByRole('dialog').waitFor({ state: 'detached' });
    await window.getByRole('navigation').getByRole('button', { name: /^Branches( \d+)?$/ }).click();
    await main.getByRole('heading', { level: 1, name: 'Branches', exact: true }).waitFor();
    // The session ends: the next read runs into it, a check confirms it, and one screen covers the window.
    writeFileSync(signInFile, 'local');
    await main.getByRole('button', { name: /^Refresh/ }).click();
    const signInScreen = window.getByRole('heading', { name: 'Your session for the server on this computer ended' });
    await signInScreen.waitFor();
    if ((await signInScreen.count()) !== 1) throw new Error(`${await signInScreen.count()} sign-in screens`);
    // Covered, the place's shortcuts are off (going to a view, Refresh): the window stays on Branches, and asks the
    // server nothing.
    const before = commandsRun().length;
    for (const key of ['5', '7', '8', 'R']) await window.keyboard.press(`ControlOrMeta+${key}`);
    await main.getByRole('heading', { level: 1, name: 'Branches', exact: true }).waitFor();
    if (await main.getByRole('heading', { level: 1, name: 'Changesets', exact: true }).isVisible()) throw new Error('a view shortcut ran while covered');
    const serverCommands = commandsRun().slice(before).filter((line) => !LOCAL_COMMAND.test(line));
    if (serverCommands.length > 0) throw new Error(`server commands ran while signed out: ${serverCommands.join('; ')}`);
  });
  await step('Signed in again', async () => {
    writeFileSync(signInFile, '');
    await window.getByRole('button', { name: 'Check again' }).click();
    await window.getByRole('heading', { name: 'Your session for the server on this computer ended' }).waitFor({ state: 'detached' });
    await main.getByRole('heading', { level: 1, name: 'Branches', exact: true }).waitFor();
    await settled();
  });
  await step('Explore a repository', async () => {
    await window.getByRole('button', { name: 'Home' }).first().click();
    await window.getByRole('navigation').getByRole('button', { name: /^This computer/ }).click();
    await window.getByRole('button', { name: 'Repository actions' }).first().click();
    await window.getByRole('menuitem', { name: 'Explore', exact: true }).click();
    await main.getByRole('heading', { level: 1, name: 'Branch Explorer', exact: true }).waitFor();
    await window.getByRole('button', { name: 'Create workspace' }).waitFor();
    // Its graph read before the next step hides the view: hidden, it would show its skeleton until shown again.
    await settled();
  });
  for (const view of REPOSITORY_VIEWS) {
    await step(`${view} of a repository`, async () => {
      await window.getByRole('navigation').getByRole('button', { name: new RegExp(`^${view}( \\d+)?$`) }).click();
      await main.getByRole('heading', { level: 1, name: view, exact: true }).waitFor();
      await settled();
    });
  }
  await step("A repository's changeset diff", async () => {
    await window.getByRole('navigation').getByRole('button', { name: /^Changesets/ }).click();
    await main.getByRole('button', { name: 'Open diff' }).click();
    await main.getByText('src/player.cs', { exact: true }).filter({ visible: true }).first().waitFor();
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
