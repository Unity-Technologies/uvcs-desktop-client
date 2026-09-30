#!/usr/bin/env node
// A fake `cm` for the smoke test (scripts/e2e/README.md): answers the commands the app runs from a small synthetic
// repository, as a process (`cm find ...`) or as a `cm shell` (`cm shell --encoding=utf-8`, commands on stdin, each
// answer ending with a `CommandResult <code>` line). A command it doesn't know fails, naming it.
const { appendFileSync } = require('node:fs');
const { createInterface } = require('node:readline');
const { answer } = require('./answers.cjs');

/** Every command, and whether it was known, goes to this file when set: what to teach the fake next. */
const LOG_FILE = process.env.UVCS_FAKE_CM_LOG;

function run(args) {
  const result = answer(args);
  if (LOG_FILE) appendFileSync(LOG_FILE, `${result.exitCode === 0 ? 'ok ' : 'ERR'} ${args.join(' ')}\n`);
  return result;
}

/** A `cm shell` line: arguments split at spaces, those holding spaces between double quotes (`toShellCommandLine`). */
function shellArguments(line) {
  return [...line.matchAll(/"([^"]*)"|(\S+)/g)].map((match) => match[1] ?? match[2]);
}

function runShell() {
  const lines = createInterface({ input: process.stdin });
  lines.on('line', (line) => {
    const args = shellArguments(line);
    if (args[0] === 'exit') process.exit(0);
    const { output, exitCode } = run(args);
    process.stdout.write(`${output}${output.endsWith('\n') || output === '' ? '' : '\n'}CommandResult ${exitCode}\n`);
  });
}

function runOnce(args) {
  const { output, exitCode } = run(args);
  process.stdout.write(output);
  process.exitCode = exitCode;
}

const args = process.argv.slice(2);
if (args[0] === 'shell') runShell();
else runOnce(args);
