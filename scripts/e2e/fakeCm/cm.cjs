#!/usr/bin/env node
// A fake `cm` for the smoke test (scripts/e2e/README.md): answers the commands the app runs from a small synthetic
// repository, as a process (`cm find ...`) or as a `cm shell` (`cm shell --encoding=utf-8`, commands on stdin, each
// answer ending with a `CommandResult <code>` line). A command it doesn't know fails, naming it.
const { appendFileSync } = require('node:fs');
const { createInterface } = require('node:readline');
const { answer } = require('./answers.cjs');

/**
 * Every command goes to this file when set, one JSON line each: its arguments, the folder it ran in, and whether the
 * fake knew it (`known`: what to teach the fake next). The smoke test reads it (`readCommandLog`).
 */
const LOG_FILE = process.env.UVCS_FAKE_CM_LOG;

function run(args) {
  const result = answer(args);
  // A command `cm` refuses (a merge its rules don't allow) was answered: only one the fake doesn't know is unknown.
  const known = result.exitCode === 0 || Boolean(result.refused);
  if (LOG_FILE) appendFileSync(LOG_FILE, `${JSON.stringify({ args, cwd: process.cwd(), known })}\n`);
  return result;
}

/** A `cm shell` line: arguments split at spaces, those holding spaces between double quotes (`toShellCommandLine`). */
function shellArguments(line) {
  return [...line.matchAll(/"([^"]*)"|(\S+)/g)].map((match) => match[1] ?? match[2]);
}

function runShell() {
  const lines = createInterface({ input: process.stdin });
  let waiting = false;
  lines.on('line', (line) => {
    // A session that asked a question reads every later line as its answer, as `cm shell` does: the app stops it.
    if (waiting) return;
    const args = shellArguments(line);
    if (args[0] === 'exit') process.exit(0);
    const { output, exitCode, prompt } = run(args);
    if (prompt) {
      waiting = true;
      process.stdout.write(prompt);
      return;
    }
    process.stdout.write(`${output}${output.endsWith('\n') || output === '' ? '' : '\n'}CommandResult ${exitCode}\n`);
  });
}

function runOnce(args) {
  const { output, exitCode, prompt } = run(args);
  // Its input closed, `cm` reads an empty answer and asks again, without end, until the app stops it.
  if (prompt) return void setInterval(() => process.stdout.write(prompt), 1);
  process.stdout.write(output);
  process.exitCode = exitCode;
}

const args = process.argv.slice(2);
if (args[0] === 'shell') runShell();
else runOnce(args);
