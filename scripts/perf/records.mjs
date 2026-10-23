// Reading `--format` records: what the main process spends reading a `cm find branch` answer (the Branch Explorer's
// `BRANCH_FORMAT`) two ways, each in a Node process of its own, from a stand-in `cm` that pipes synthetic records:
// - `text`: the baseline, as before `RecordReader`: the whole output decoded and joined into one string, CRLF
//   replaced, then split into records and fields and mapped to branches. No list is read so anymore
//   (ARCHITECTURE.md "No list is one string"); it stays to measure what streaming saves, its text kept whole whatever
//   its size.
// - `records`: `CmClient.queryRecords`' way: `runCmProcess` with a `RecordReader` reading each record into a branch
//   as its bytes arrive (`graphBranch`).
//
//   node scripts/perf/records.mjs [--records=20000,100000,1000000] [--runs=3]
//   ELECTRON_RUN_AS_NODE=1 node_modules/.bin/electron scripts/perf/records.mjs     # with Electron's V8, as main runs
//
// For each size and way it prints the median time from starting the command to holding the branches, and how much
// the process's peak RSS grew (what the main process needs to read the answer) and its heap holds after a GC (what
// the branches weigh). Nothing here talks to a server.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, createWriteStream } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const FIELD = '\u001f';
const RECORD = '\u001e';

if (process.argv[2] === '--measure') await measure(...process.argv.slice(3));
else await compare();

async function compare() {
  const options = Object.fromEntries(process.argv.slice(2).map((arg) => arg.replace(/^--/, '').split('=')));
  const sizes = (options.records ?? '20000,100000,1000000').split(',').map(Number);
  const runs = Number(options.runs ?? 3);
  const folder = mkdtempSync(join(tmpdir(), 'uvcs-records-perf-'));
  try {
    const bundle = await bundleReaders(folder);
    const standIn = join(folder, 'cm.cjs');
    // Pipes the file to stdout as `cm` writes its answer: in chunks, as fast as it is read.
    writeFileSync(standIn, "require('node:fs').createReadStream(process.argv[2]).pipe(process.stdout);\n");
    console.log('  records  way       output      time  peak RSS growth   heap held');
    for (const size of sizes) {
      const output = join(folder, `branches-${size}.txt`);
      const bytes = await writeBranches(output, size);
      for (const way of ['text', 'records']) {
        const measured = Array.from({ length: runs }, () => run(bundle, standIn, output, way));
        const median = (key) => measured.map((m) => m[key]).sort((a, b) => a - b)[Math.floor(runs / 2)];
        console.log(
          `${String(size).padStart(9)}  ${way.padEnd(7)}  ${mb(bytes).padStart(7)}  ${`${median('ms').toFixed(0)} ms`.padStart(8)}  ${mb(median('peakGrowth')).padStart(14)}  ${mb(median('heapHeld')).padStart(10)}`,
        );
      }
    }
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
}

function run(bundle, standIn, output, way) {
  const script = fileURLToPath(import.meta.url);
  const result = spawnSync(process.execPath, ['--expose-gc', script, '--measure', bundle, standIn, output, way], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr);
  return JSON.parse(result.stdout);
}

/** The app's own readers, bundled from the sources: `runCmProcess`, `RecordReader`, `graphBranch`. */
async function bundleReaders(folder) {
  const { build } = await import('esbuild');
  const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
  const outfile = join(folder, 'readers.mjs');
  await build({
    stdin: {
      contents: [
        "export { runCmProcess } from './src/main/cm/runCmProcess';",
        "export { RecordReader } from './src/main/cm/formatRecords';",
        "export { graphBranch } from './src/main/cm/branchExplorerRecords';",
      ].join('\n'),
      resolveDir: root,
      loader: 'ts',
    },
    bundle: true,
    platform: 'node',
    format: 'esm',
    alias: { '@shared': join(root, 'src', 'shared') },
    outfile,
    logLevel: 'error',
  });
  return outfile;
}

/** `cm find branch --format=BRANCH_FORMAT` output for `count` branches, as a big repository answers it. */
async function writeBranches(file, count) {
  const out = createWriteStream(file);
  let bytes = 0;
  for (let id = 0; id < count; id++) {
    const parent = id < 10 ? '/main' : `/main/team-${id % 300}`;
    const record = [
      1000 + id,
      `${parent}/task-${id}`,
      parent,
      `developer.${id % 400}@studio.com`,
      `2026-${String(1 + (id % 12)).padStart(2, '0')}-${String(1 + (id % 28)).padStart(2, '0')}T10:11:12.0000000+02:00`,
      5000 + id,
      `Fixes the jump of the character in level ${id % 50}`,
    ].join(FIELD);
    const line = `${record}${RECORD}\n`;
    bytes += Buffer.byteLength(line);
    if (!out.write(line)) await new Promise((resolve) => out.once('drain', resolve));
  }
  await new Promise((resolve) => out.end(resolve));
  return bytes;
}

async function measure(bundle, standIn, output, way) {
  const { runCmProcess, RecordReader, graphBranch } = await import(bundle);
  global.gc();
  const rssBefore = process.resourceUsage().maxRSS * 1024;
  const heapBefore = process.memoryUsage().heapUsed;
  const started = performance.now();

  let branches;
  if (way === 'text') {
    const whole = { text: { maxLength: Number.POSITIVE_INFINITY, past: 'stop' } };
    const { output: text } = await runCmProcess(process.execPath, [standIn, output], { reading: whole });
    branches = branchesAsBefore(text);
  } else {
    const records = new RecordReader(graphBranch(false));
    await runCmProcess(process.execPath, [standIn, output], { reading: { stream: records } });
    branches = records.finish();
  }

  const ms = performance.now() - started;
  const peakGrowth = process.resourceUsage().maxRSS * 1024 - rssBefore;
  global.gc();
  const heapHeld = process.memoryUsage().heapUsed - heapBefore;
  process.stdout.write(JSON.stringify({ ms, peakGrowth, heapHeld, count: branches.length }));
}

/** How `parseBranches` read a whole output before `RecordReader`: split into records, then fields, then mapped. */
function branchesAsBefore(output) {
  const unquote = (value) => (value.length >= 2 && value.startsWith('"') && value.endsWith('"') ? value.slice(1, -1) : value);
  const toInteger = (value) => {
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? -1 : parsed;
  };
  return output
    .split(RECORD)
    .map((record) => record.replace(/^\r?\n/, ''))
    .filter((record) => record.length > 0)
    .map((record) => record.split(FIELD).map(unquote))
    .map(([id = '', name = '', parent = '', owner = '', date = '', head = '', comment = '']) => ({
      id: toInteger(id),
      name,
      parent,
      owner,
      date,
      comment,
      headChangeset: toInteger(head),
      isHidden: false,
    }));
}

function mb(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(0)} MB`;
}
