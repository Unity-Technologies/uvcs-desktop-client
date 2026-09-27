// Soak test: drives a running app through a long working session and samples memory every cycle, to catch leaks.
//
// Every cycle visits every view (selecting rows, opening row menus and each view's pages: diffs, history, annotate,
// the merge preview), opens the palette, settings, dialogs and menus, and edits a file on disk so the watcher refreshes.
// After each cycle it forces a GC and records the renderer's heap, DOM nodes, listeners, TanStack Query cache size and
// blob URLs not revoked, the main process's heap and RSS, and how many `cm` processes run. At the end it prints the
// growth per cycle and the idle CPU of every process over 30 s.
//
// The workspace must be a sandbox on a local server (the cycle creates and deletes a private file, and edits one);
// `scripts/sandboxes/demo.sh` makes one that fits the defaults:
//   npm run build
//   npx electron . --remote-debugging-port=9510 --inspect=10510 --user-data-dir=/tmp/soak-userdata \
//     --disable-renderer-backgrounding --disable-backgrounding-occluded-windows --disable-background-timer-throttling &
//   node scripts/perf/soak.mjs --workspace=/tmp/uvcs-demo [--minutes=30] [--cycles=N] [--cdp=9510] [--inspect=10510]
//     [--out=/tmp/soak.csv] [--merge-branch=/main/drift] [--history-file=README.md] [--others=/tmp/wk-2,/tmp/wk-3]
//     [--binary-merge-branch=/main/art] [--snapshots=/tmp/soak-snapshots]
// - The merge preview merges `--merge-branch` to /main on the server and never completes it.
// - `--others`: each cycle switches the window to the next of those workspaces (of any repository) and back.
// - `--binary-merge-branch`: there, it previews merging that branch, whose binary conflict it resolves each way and
//   checks both versions show (the other workspaces must be clean).
// - `--snapshots`: heap snapshots of the renderer and the main process after the third cycle and at the end, to compare
//   in DevTools (Memory, Comparison). Take them here, not from another connection: each one adds its own contexts to
//   the renderer's heap.
import { execFileSync } from 'node:child_process';
import { appendFileSync, createWriteStream, mkdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright-core';

const options = Object.fromEntries(process.argv.slice(2).map((arg) => arg.replace(/^--/, '').split('=')));
const workspace = options.workspace ?? fail('--workspace=<path> is required');
const minutes = Number(options.minutes ?? 30);
const maxCycles = Number(options.cycles ?? Infinity);
const cdpPort = options.cdp ?? '9510';
const inspectPort = options.inspect ?? '10510';
const out = options.out ?? '/tmp/soak.csv';
const mergeBranch = options['merge-branch'] ?? '/main/drift';
const historyFile = options['history-file'] ?? 'README.md';
const others = options.others ? options.others.split(',') : [];
const binaryMergeBranch = options['binary-merge-branch'];
const snapshots = options.snapshots;

function fail(message) {
  console.error(message);
  process.exit(1);
}

// ── Main process, through its Node inspector ────────────────────────────────────────────────────────────────────
async function connectInspector(port, onEvent) {
  const [target] = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => ((socket.onopen = resolve), (socket.onerror = reject)));
  let nextId = 1;
  const pending = new Map();
  socket.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    if (message.method) onEvent(message.method, message.params);
    pending.get(message.id)?.(message.result);
    pending.delete(message.id);
  };
  return (method, params = {}) =>
    new Promise((resolve) => {
      const id = nextId++;
      pending.set(id, resolve);
      socket.send(JSON.stringify({ id, method, params }));
    });
}

const mainEvents = new Map();
const mainCdp = await connectInspector(inspectPort, (method, params) => mainEvents.get(method)?.(params));
const evaluateInMain = async (expression) => (await mainCdp('Runtime.evaluate', { expression, returnByValue: true })).result.value;
const mainPid = await evaluateInMain('process.pid');

// ── Renderer ────────────────────────────────────────────────────────────────────────────────────────────────────
const browser = await chromium.connectOverCDP(`http://localhost:${cdpPort}`);
const page = browser.contexts()[0].pages()[0];
const cdp = await page.context().newCDPSession(page);
const browserCdp = await browser.newBrowserCDPSession();
await cdp.send('Performance.enable');
page.setDefaultTimeout(8000);
page.on('pageerror', (error) => console.error('[pageerror]', error.message));

/** The size of TanStack Query's cache, found through React's fiber tree (the app doesn't expose its client). */
function queryCacheSize() {
  const container = document.getElementById('root');
  const rootKey = Object.keys(container).find((key) => key.startsWith('__reactContainer'));
  const stack = [container[rootKey]];
  while (stack.length) {
    const fiber = stack.pop();
    const client = fiber?.memoizedProps?.client;
    if (client?.getQueryCache) return client.getQueryCache().getAll().length;
    if (fiber?.child) stack.push(fiber.child);
    if (fiber?.sibling) stack.push(fiber.sibling);
  }
  return -1;
}

function cmProcesses() {
  const rows = execFileSync('ps', ['-A', '-o', 'pid=,ppid=,comm=']).toString().trim().split('\n');
  const processes = rows.map((row) => row.trim().split(/\s+/, 3)).map(([pid, ppid, comm]) => ({ pid: +pid, ppid: +ppid, comm }));
  return processes.filter((process) => process.ppid === mainPid && /(^|\/)cm$/.test(process.comm)).length;
}

async function sample(cycle) {
  await cdp.send('HeapProfiler.collectGarbage');
  await mainCdp('HeapProfiler.collectGarbage');
  const { metrics } = await cdp.send('Performance.getMetrics');
  const metric = Object.fromEntries(metrics.map((entry) => [entry.name, entry.value]));
  const dom = await cdp.send('Memory.getDOMCounters');
  const main = await evaluateInMain('JSON.stringify({ heap: process.memoryUsage().heapUsed, rss: process.memoryUsage().rss })');
  const { heap, rss } = JSON.parse(main);
  return {
    cycle,
    minutes: ((Date.now() - started) / 60000).toFixed(1),
    heapMB: (metric.JSHeapUsedSize / 1e6).toFixed(2),
    nodes: dom.nodes,
    listeners: dom.jsEventListeners,
    documents: dom.documents,
    queries: await page.evaluate(queryCacheSize),
    blobUrls: await page.evaluate(() => window.__soakBlobUrls.size),
    mainHeapMB: (heap / 1e6).toFixed(2),
    mainRssMB: (rss / 1e6).toFixed(1),
    cm: cmProcesses(),
  };
}

async function writeHeapSnapshots(label) {
  mkdirSync(snapshots, { recursive: true });
  for (const [process, send, on] of [
    ['renderer', (method) => cdp.send(method), (listener) => cdp.on('HeapProfiler.addHeapSnapshotChunk', listener)],
    ['main', (method) => mainCdp(method), (listener) => mainEvents.set('HeapProfiler.addHeapSnapshotChunk', listener)],
  ]) {
    const file = createWriteStream(join(snapshots, `${process}-${label}.heapsnapshot`));
    on(({ chunk }) => file.write(chunk));
    await send('HeapProfiler.enable');
    await send('HeapProfiler.takeHeapSnapshot');
    await new Promise((resolve) => file.end(resolve));
  }
  cdp.removeAllListeners('HeapProfiler.addHeapSnapshotChunk');
}

/** Counts the blob URLs made and not revoked yet (images are painted from them). */
function trackBlobUrls() {
  if (window.__soakBlobUrls) return;
  const live = (window.__soakBlobUrls = new Set());
  const { createObjectURL, revokeObjectURL } = URL;
  URL.createObjectURL = (object) => {
    const url = createObjectURL(object);
    live.add(url);
    return url;
  };
  URL.revokeObjectURL = (url) => {
    live.delete(url);
    revokeObjectURL(url);
  };
}
await page.evaluate(trackBlobUrls);

// ── Steps ───────────────────────────────────────────────────────────────────────────────────────────────────────
const main = page.getByRole('main');
const settle = (ms = 500) => page.waitForTimeout(ms);
const press = async (keys, ms = 150) => {
  await page.keyboard.press(keys);
  await settle(ms);
};

async function goToView(name) {
  await page.getByRole('navigation').getByRole('button', { name: new RegExp(`^${name}( \\d+)?$`) }).click();
  await settle(700);
}

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function switchWorkspaceTo(path) {
  await page.getByRole('button', { name: 'Switch workspace' }).click();
  await page.keyboard.type(path);
  await page.getByRole('option', { name: new RegExp(` ${escapeRegExp(realpathSync(path))}( |$)`) }).click();
  await settle(2500);
}

async function back() {
  await press('Meta+[', 500);
}

/** Selects the list's rows one by one, opens the context menu of one and closes it. */
async function browseRows(rowRole = 'row', count = 4) {
  const rows = main.getByRole(rowRole);
  if ((await rows.count()) < 2) return;
  await rows.nth(1).click();
  for (let step = 0; step < count; step++) await press('ArrowDown', 120);
  await press('ArrowUp', 120);
  await rows.nth(1).click({ button: 'right' });
  await settle(250);
  await press('Escape');
}

/** Opens the first row's page (Enter), steps through it and goes back. */
async function openFirstRow() {
  const rows = main.getByRole('row');
  if ((await rows.count()) < 2) return;
  await rows.nth(1).click();
  await press('Enter', 1500);
  await press('ArrowDown', 400);
  await back();
}

function editOnDisk(cycle) {
  // Two alternating states, so the pending changes stay the same size however long the soak runs.
  writeFileSync(join(workspace, 'soak-notes.txt'), `Soak cycle parity ${cycle % 2}\n`);
  if (cycle % 2) writeFileSync(join(workspace, 'soak-scratch.txt'), 'scratch\n');
  else rmSync(join(workspace, 'soak-scratch.txt'), { force: true });
}

const steps = {
  async changes(cycle) {
    await goToView('Changes');
    editOnDisk(cycle);
    await settle(1500);
    await main.getByRole('radio', { name: 'Files', exact: true }).click();
    await main.getByRole('radio', { name: 'List', exact: true }).click();
    await settle(300);
    await browseRows('option', 4);
    const filter = main.getByRole('textbox', { name: /^Filter/ });
    await filter.fill('Player');
    await settle(300);
    await filter.fill('');
    for (const mode of ['Tree', 'Changelists', 'Files', 'List']) {
      await main.getByRole('radio', { name: mode, exact: true }).click();
      await settle(300);
    }
  },
  async incoming() {
    await goToView('Incoming');
  },
  async files() {
    await goToView('Files');
    await browseRows();
    await main.getByRole('row', { name: new RegExp(`^${historyFile}`) }).click();
    await press('Meta+y', 1200);
    await openFirstRow();
    await back();
    await press('Meta+t', 1200);
    await back();
  },
  async branchExplorer() {
    await goToView('Branch Explorer');
    await settle(800);
    for (const key of ['h', 'ArrowLeft', 'ArrowLeft', 'ArrowUp', 'ArrowDown', 'ArrowRight', '=', '-', '0', 'Space', 'Space']) await press(key, 150);
  },
  async changesets() {
    await goToView('Changesets');
    await browseRows();
    await openFirstRow();
  },
  async branches() {
    await goToView('Branches');
    await browseRows();
    const filter = main.getByRole('textbox', { name: 'Filter branches' });
    await filter.fill(mergeBranch.split('/').pop());
    await settle(500);
    await openFirstRow();
    await main.getByRole('row').nth(1).click({ button: 'right' });
    await page.getByRole('menuitem', { name: /^Merge to \/main/ }).click();
    await page.getByRole('button', { name: /^Or merge on the server/ }).click({ timeout: 8000 });
    await settle(1500);
    await back();
    await filter.fill('');
  },
  async labels() {
    await goToView('Labels');
    await browseRows();
    await openFirstRow();
  },
  async shelves() {
    await goToView('Shelves');
    await browseRows();
    await openFirstRow();
  },
  async attributes() {
    await goToView('Attributes');
    await browseRows();
  },
  async codeReviews() {
    await goToView('Code reviews');
    await browseRows();
    await openFirstRow();
  },
  async locks() {
    await goToView('Locks');
  },
  async sync() {
    await goToView('Sync');
  },
  async overlays() {
    await press('Meta+k', 400);
    await page.keyboard.type('bra');
    await press('ArrowDown', 200);
    await press('Escape', 300);
    await press('Meta+p', 400);
    await page.keyboard.type('Player');
    await press('Escape', 300);
    await press('Meta+Comma', 600);
    for (const section of ['Pending changes', 'Check in', 'Merge', 'Workspaces', 'Appearance']) {
      await page.getByRole('dialog').getByRole('button', { name: section }).click();
      await settle(200);
    }
    await page.getByRole('button', { name: 'Done' }).click();
    await press('Meta+b', 500);
    await press('Escape', 300);
    await press('Meta+Shift+w', 500);
    await press('Escape', 300);
    await press('Meta+/', 400);
    await press('Escape', 300);
    await press('Meta+Shift+l', 400);
    await press('Meta+Shift+l', 300);
    await page.getByRole('button', { name: 'Switch workspace' }).click();
    await settle(500);
    await press('Escape', 300);
  },
  async otherWorkspace(cycle) {
    if (others.length === 0) return;
    await switchWorkspaceTo(others[cycle % others.length]);
    try {
      await goToView('Changesets');
      await browseRows();
      if (binaryMergeBranch) await previewBinaryMerge();
    } finally {
      await recover();
      await switchWorkspaceTo(workspace);
    }
  },
};

/** Merges `--binary-merge-branch` into the (clean) other workspace, picks each side of its conflict, and leaves. */
async function previewBinaryMerge() {
  await goToView('Branches');
  const filter = main.getByRole('textbox', { name: 'Filter branches' });
  await filter.fill(binaryMergeBranch.split('/').pop());
  await settle(500);
  await main.getByRole('row').nth(1).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Merge into this workspace' }).click();
  for (const side of ['yours', 'incoming', 'yours']) {
    const card = main.getByRole('button', { name: new RegExp(`^Keep ${side} `) });
    await card.click();
    await main.getByRole('option', { name: new RegExp(`Keeping ${side}$`) }).waitFor();
  }
  const decoded = await main.locator('img[alt^="Keep "]').evaluateAll((images) => images.filter((image) => image.naturalWidth > 0).length);
  if (decoded !== 2) throw new Error(`${decoded} of the 2 versions of the binary conflict show`);
  await back();
  await filter.fill('');
}

async function recover() {
  for (let attempt = 0; attempt < 3; attempt++) await press('Escape', 200);
  await back();
}

// ── Run ─────────────────────────────────────────────────────────────────────────────────────────────────────────
if (await page.getByPlaceholder('Find a workspace').isVisible()) {
  await page.getByPlaceholder('Find a workspace').fill(workspace.split('/').pop());
  await page.getByRole('button', { name: new RegExp(escapeRegExp(realpathSync(workspace))) }).first().click();
  await settle(3000);
} else {
  // The switcher doesn't list the workspace the window already shows.
  await switchWorkspaceTo(workspace).catch(() => press('Escape'));
}

const started = Date.now();
const samples = [];
const failures = {};
for (let cycle = 0; cycle < maxCycles && Date.now() - started < minutes * 60000; cycle++) {
  for (const [name, step] of Object.entries(steps)) {
    try {
      await step(cycle);
    } catch (error) {
      failures[name] = (failures[name] ?? 0) + 1;
      if (failures[name] <= 2) console.error(`[${name}] ${error.message.split('\n').slice(0, 3).join(' ')}`);
      await recover();
    }
  }
  const row = await sample(cycle);
  samples.push(row);
  if (cycle === 0) writeFileSync(out, Object.keys(row).join(',') + '\n');
  appendFileSync(out, Object.values(row).join(',') + '\n');
  console.log(Object.entries(row).map(([key, value]) => `${key}=${value}`).join(' '));
  if (snapshots && cycle === 2) await writeHeapSnapshots(`cycle-${cycle}`);
}
if (snapshots) await writeHeapSnapshots(`cycle-${samples.at(-1).cycle}`);
rmSync(join(workspace, 'soak-notes.txt'), { force: true });
rmSync(join(workspace, 'soak-scratch.txt'), { force: true });

// Growth per cycle between the second quarter and the end (the first cycles warm caches and lazy chunks up).
const from = samples[Math.floor(samples.length / 4)];
const to = samples.at(-1);
console.log(`\nGrowth per cycle over cycles ${from.cycle}–${to.cycle}:`);
for (const key of ['heapMB', 'nodes', 'listeners', 'queries', 'blobUrls', 'mainHeapMB', 'mainRssMB', 'cm']) {
  console.log(`  ${key.padEnd(11)} ${from[key]} → ${to[key]}  (${((to[key] - from[key]) / Math.max(1, to.cycle - from.cycle)).toFixed(3)}/cycle)`);
}
if (Object.keys(failures).length) console.log('Failed steps:', failures);

// Idle: CPU time each process spends in 30 s with the window focused and nothing touched.
await goToView('Changes');
const cpuTimes = async () => Object.fromEntries((await browserCdp.send('SystemInfo.getProcessInfo')).processInfo.map((info) => [`${info.type}:${info.id}`, info.cpuTime]));
const before = await cpuTimes();
await settle(30000);
const after = await cpuTimes();
console.log('\nIdle CPU over 30 s:');
for (const [process, time] of Object.entries(after)) console.log(`  ${process.padEnd(16)} ${(((time - (before[process] ?? 0)) / 30) * 100).toFixed(2)}%`);
process.exit(0);
