// Start-up time: launches the built app (run `npm run build` first) several times and prints the median time from
// starting the process to each step of its start-up, cold (a new user data folder: no settings, no code cache, the
// first-run import) and warm (the same folder again).
//
//   node scripts/perf/startup.mjs [--cm=fake|real] [--workspace=/tmp/uvcs-demo] [--runs=5] [--flows=home,last]
//     [--temperatures=cold,warm] [--launch=open|direct] [--app=<built checkout>] [--timeline] [--json=<file>]
//
// - `--cm=fake` (the default) answers from the smoke test's fake `cm` (scripts/e2e/fakeCm) and a temp workspace:
//   deterministic, no `cm` needed. `--cm=real` runs the installed `cm` on `--workspace`, a sandbox on a local server
//   (`scripts/sandboxes/demo.sh` makes /tmp/uvcs-demo); the app only reads it, as it starts.
// - Flows: `home` starts on the home screen, as development builds do, then opens the workspace from its list;
//   `last` starts as the installed app does, reopening the last workspace used (`openFirst`).
//   In `last`, a "home screen with workspaces" time means the home screen showed before the workspace did.
// - `--launch=open` (the default on macOS) starts the app through LaunchServices, as the Dock and Finder do: an app
//   started from a terminal isn't the active one, and making it so as its window shows (`show()`) holds the main
//   process for 40-120 ms more, and creating the window for 40 ms more. `--launch=direct` (elsewhere) runs Electron.
// - `--timeline` prints each run's window steps, API calls and processes on the way (what waits for what).
//
// Nothing in the app measures itself: `startupProbe.cjs`, loaded into the main process through NODE_OPTIONS, times the
// main process's steps, its processes and the page's API calls, and adds a preload (`startupMarks.cjs`) that marks when
// each screen first shows; the script reads the page's marks and paint times through the DevTools protocol.
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import electron from 'electron';
import { fakeCmExecutable } from '../e2e/fakeCm/executable.mjs';
import { createWorkspace } from '../e2e/workspaceFixture.mjs';

const options = Object.fromEntries(process.argv.slice(2).map((arg) => [...arg.replace(/^--/, '').split('='), true].slice(0, 2)));
const useRealCm = options.cm === 'real';
const runs = Number(options.runs ?? 5);
const flows = (options.flows ?? 'home,last').split(',');
const temperatures = (options.temperatures ?? 'cold,warm').split(',');
const launcher = (options.launch ?? (process.platform === 'darwin' ? 'open' : 'direct')) === 'open' ? startThroughLaunchServices : startDirectly;
const TIMEOUT_MS = 30_000;

// Another checkout's build (`--app=<folder>`) compares two versions with the same script.
const projectFolder = options.app ?? fileURLToPath(new URL('../..', import.meta.url));
const probePath = fileURLToPath(new URL('./startupProbe.cjs', import.meta.url));
const temp = mkdtempSync(join(tmpdir(), 'uvcs-startup-'));
if (!useRealCm) createWorkspace(join(temp, 'demo'));
// As `cm` lists it (macOS's /tmp is /private/tmp), so the home screen finds it among its recent workspaces.
const workspace = realpathSync(useRealCm ? (options.workspace ?? '/tmp/uvcs-demo') : join(temp, 'demo'));
const cmEnv = useRealCm
  ? {}
  : { UVCS_CM_PATH: fakeCmExecutable(temp), UVCS_FAKE_WORKSPACE: workspace, PLASTIC_HOME: join(temp, 'plastic4') };

/** The steps printed, in order: where each one's time comes from. */
const STEPS = [
  ['main process started', (r) => r.probe.processStart],
  ['main module evaluated', (r) => r.probe.mainModuleEvaluated],
  ['app ready', (r) => r.probe.appReady],
  ['window created', (r) => r.probe.windowCreated],
  ['page navigation start', (r) => r.page.timeOrigin],
  ['page scripts run (DOMContentLoaded)', (r) => r.page.timeOrigin + r.page.domContentLoaded],
  ['first render (React)', (r) => r.page.timeOrigin + r.page.marks.firstRender],
  ['first contentful paint', (r) => r.page.timeOrigin + r.page.firstContentfulPaint],
  ['window shown', (r) => r.probe.windowShown],
  ['page seen (painted and shown)', (r) => Math.max(r.page.timeOrigin + r.page.firstContentfulPaint, r.probe.windowShown)],
  ['home screen with workspaces', (r) => r.page.timeOrigin + r.page.marks.homeReady],
  ['workspace screen shown', (r) => r.page.timeOrigin + r.page.marks.workspaceShown],
  ['Changes showing data', (r) => r.page.timeOrigin + r.page.marks.changesReady],
];

function settings() {
  // The workspace is the only recent one: the one the installed app reopens, and the one the home screen opens.
  return { theme: 'light', showGravatar: false, legacySettingsImported: false, recentWorkspacePaths: [workspace] };
}

const results = [];
for (const flow of flows) {
  for (const temperature of temperatures) {
    const scenario = `${flow === 'home' ? 'home screen' : 'last workspace'}, ${temperature}`;
    const warmFolder = join(temp, `user-data-${flow}-warm`);
    if (temperature === 'warm') {
      prepareUserData(warmFolder);
      await launch(flow, warmFolder); // Fills the code cache and settings the measured runs start with.
    }
    for (let run = 0; run < runs; run++) {
      const userData = temperature === 'warm' ? warmFolder : join(temp, `user-data-${flow}-cold-${run}`);
      if (temperature === 'cold') prepareUserData(userData);
      const result = await launch(flow, userData);
      results.push({ scenario, flow, temperature, ...result });
      if (options.timeline) printTimeline(scenario, run, result);
    }
    printMedians(scenario, results.filter((result) => result.scenario === scenario));
  }
}
if (options.json) writeFileSync(options.json, JSON.stringify(results, null, 2));
rmSync(temp, { recursive: true, force: true, maxRetries: 5 });

function prepareUserData(folder) {
  rmSync(folder, { recursive: true, force: true });
  mkdirSync(folder, { recursive: true });
  writeFileSync(join(folder, 'settings.json'), JSON.stringify(settings()));
}

/** Starts the app, waits until the flow's last step shows, and quits it. */
async function launch(flow, userData) {
  const probeOut = join(temp, `probe-${Date.now()}.json`);
  const env = {
    ...cmEnv,
    NODE_OPTIONS: `--require=${probePath}`,
    UVCS_STARTUP_PROBE_OUT: probeOut,
    UVCS_STARTUP_AS_INSTALLED: flow === 'last' ? '1' : '0',
  };
  const spawned = performance.timeOrigin + performance.now();
  const app = launcher([`--user-data-dir=${userData}`, '--remote-debugging-port=0'], env);
  try {
    const browser = await connect(await withTimeout(app.devToolsUrl, TIMEOUT_MS, 'the DevTools port'));
    const page = await firstPage(browser);
    await page.waitFor(flow === 'home' ? 'homeReady' : 'changesReady');
    let openedFromHome;
    if (flow === 'home') {
      const clicked = await page.evaluate(`(() => { const row = document.querySelector('[aria-label="Recent"] [data-workspace-row]'); row.click(); return performance.now(); })()`);
      const shown = await page.waitFor('changesReady');
      openedFromHome = shown - clicked;
    }
    const timing = await page.evaluate(`(() => ({
      timeOrigin: performance.timeOrigin,
      domContentLoaded: performance.getEntriesByType('navigation')[0].domContentLoadedEventEnd,
      firstContentfulPaint: performance.getEntriesByName('first-contentful-paint')[0]?.startTime,
      marks: window.startupMarks.read(),
    }))()`);
    browser.close();
    await withTimeout(app.quit(), 10_000, 'the app to quit');
    const probe = JSON.parse(readFileSync(probeOut, 'utf8'));
    return { spawned, probe, page: timing, openedFromHome };
  } catch (error) {
    app.kill();
    throw error;
  }
}

/** Runs Electron on the project, with `env` added to this process's. */
function startDirectly(args, env) {
  const app = spawn(electron, ['.', ...args], { cwd: projectFolder, env: { ...process.env, ...env } });
  const exited = new Promise((resolve) => app.once('exit', resolve));
  let stderr = '';
  const devToolsUrl = new Promise((resolve) =>
    app.stderr.on('data', (chunk) => {
      stderr += chunk;
      const url = devToolsUrlIn(stderr);
      if (url) resolve(url);
    }),
  );
  return { devToolsUrl, quit: () => (app.kill('SIGTERM'), exited), kill: () => app.kill('SIGKILL') };
}

/**
 * Opens Electron's app bundle on the project as the Dock does (`open -n -a`), with only `env` (and PATH, which the
 * fake `cm` needs to find Node) added to what LaunchServices gives an app. The app's main process is found by its
 * user data folder (`args[0]`), which only this run uses.
 */
function startThroughLaunchServices(args, env) {
  const bundle = electron.replace(/\/Contents\/MacOS\/[^/]+$/, '');
  const stderrFile = join(temp, `stderr-${Date.now()}.txt`);
  const envArgs = Object.entries({ ...env, PATH: process.env.PATH }).flatMap(([name, value]) => ['--env', `${name}=${value}`]);
  spawn('open', ['-n', '-a', bundle, '--stderr', stderrFile, ...envArgs, '--args', projectFolder, ...args]);
  const devToolsUrl = poll(() => existsSync(stderrFile) && devToolsUrlIn(readFileSync(stderrFile, 'utf8')));
  const pid = () => Number(execFileSync('pgrep', ['-P', '1', '-f', '--', args[0]], { encoding: 'utf8' }).trim().split('\n')[0]);
  return {
    devToolsUrl,
    quit: async () => {
      const id = pid();
      process.kill(id, 'SIGTERM');
      await poll(() => !isRunning(id));
    },
    kill: () => process.kill(pid(), 'SIGKILL'),
  };
}

function isRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** The browser's DevTools address, which Electron prints once its port is open. */
function devToolsUrlIn(stderr) {
  return /DevTools listening on (ws:\/\/\S+)/.exec(stderr)?.[1];
}

/** Resolves with what `check` returns once it's truthy, checking every 10 ms. */
function poll(check) {
  return new Promise((resolve) => {
    const next = () => {
      const value = check();
      if (value) resolve(value);
      else setTimeout(next, 10);
    };
    next();
  });
}

/** A DevTools protocol connection: `send` a command (to a session). */
async function connect(url) {
  const socket = new WebSocket(url);
  await new Promise((resolve, reject) => ((socket.onopen = resolve), (socket.onerror = reject)));
  let nextId = 1;
  const pending = new Map();
  socket.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    if (!message.id) return;
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else resolve(message.result);
  };
  return {
    send: (method, params = {}, sessionId) =>
      new Promise((resolve, reject) => {
        const id = nextId++;
        pending.set(id, { resolve, reject });
        socket.send(JSON.stringify({ id, method, params, sessionId }));
      }),
    close: () => socket.close(),
  };
}

/** The first window's page. `waitFor(mark)` resolves with the page's time of that mark (`startupMarks.cjs`) once set. */
async function firstPage(browser) {
  const pageTarget = async () => {
    const { targetInfos } = await browser.send('Target.getTargets');
    // Its page, once the window navigated from its first blank one.
    return targetInfos.find((target) => target.type === 'page' && target.url.startsWith('file:')) ?? (await new Promise((resolve) => setTimeout(resolve, 20)).then(pageTarget));
  };
  const { targetId } = await withTimeout(pageTarget(), TIMEOUT_MS, 'the first window');
  const { sessionId } = await browser.send('Target.attachToTarget', { targetId, flatten: true });
  const evaluate = async (expression) => {
    const { result, exceptionDetails } = await browser.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, sessionId);
    if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
    return result.value;
  };
  const markTime = (mark) =>
    evaluate(`new Promise((resolve) => {
      const poll = () => {
        const time = window.startupMarks?.read().${mark};
        if (time === undefined) setTimeout(poll, 20);
        else resolve(time);
      };
      poll();
    })`).catch((error) => {
      // Attached while the window still showed its first blank page: ask the app's page.
      if (error.message.includes('context was destroyed')) return markTime(mark);
      throw error;
    });
  const waitFor = (mark) => withTimeout(markTime(mark), TIMEOUT_MS, mark);
  return { evaluate, waitFor };
}

function withTimeout(promise, ms, what) {
  let timer;
  const timeout = new Promise((_, reject) => (timer = setTimeout(() => reject(new Error(`Timed out waiting for ${what}`)), ms)));
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function median(values) {
  const sorted = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (sorted.length === 0) return undefined;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function printMedians(scenario, scenarioResults) {
  console.log(`\n${scenario} (${useRealCm ? 'real' : 'fake'} cm, median of ${scenarioResults.length} runs, ms since the process was started)`);
  for (const [name, time] of STEPS) {
    const value = median(scenarioResults.map((result) => time(result) - result.spawned));
    if (value !== undefined) console.log(`  ${name.padEnd(38)} ${value.toFixed(0).padStart(6)}`);
  }
  const fromHome = median(scenarioResults.map((result) => result.openedFromHome));
  if (fromHome !== undefined) console.log(`  ${'open from home → Changes showing data'.padEnd(38)} ${fromHome.toFixed(0).padStart(6)}`);
}

function printTimeline(scenario, run, { spawned, probe }) {
  console.log(`\n${scenario}, run ${run + 1}: the window's steps, API calls and processes (ms since the process was started)`);
  const at = (time) => (time === undefined ? '     -' : (time - spawned).toFixed(0).padStart(6));
  const steps = ['appReady', 'windowCreated', 'readyToShow', 'windowShown'].filter((step) => probe[step]);
  const events = [
    ...steps.map((step) => ({ start: probe[step], line: `${at(probe[step])}           window: ${step}` })),
    ...probe.calls.map((call) => ({ start: call.started, line: `${at(call.started)} → ${at(call.ended)}  ${call.method}` })),
    ...probe.processes.map((child) => ({
      start: child.started,
      line: `${at(child.started)} → ${at(child.exited)}  process ${child.args.join(' ')}${child.firstOutput ? ` (first output at ${at(child.firstOutput).trim()})` : ''}`,
    })),
  ];
  events.sort((a, b) => a.start - b.start).forEach(({ line }) => console.log(`  ${line}`));
}
