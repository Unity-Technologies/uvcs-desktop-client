#!/usr/bin/env node
// Stands in for `cm shell` in tests. Commands: `version`, `echo <text>`, `fail`, `prompt` (asks a question and waits),
// `pause` (writes a line that ends like a question, then the rest of it a moment later), `quote` (output holding a
// `CommandResult` line of its own, like a changeset comment quoting a `cm shell` session).
import { createInterface } from 'node:readline';

const lines = createInterface({ input: process.stdin });
let waitingForAnswer = false;

lines.on('line', (line) => {
  if (waitingForAnswer) {
    process.stdout.write(`answer was ${line}\nCommandResult 0\n`);
    waitingForAnswer = false;
    return;
  }
  const [command, ...rest] = line.split(' ');
  if (command === 'version') process.stdout.write('1.0.0.0\nCommandResult 0\n');
  else if (command === 'echo') process.stdout.write(`${rest.join(' ')}\nCommandResult 0\n`);
  else if (command === 'fail') process.stdout.write('Something went wrong\nCommandResult 1\n');
  else if (command === 'quote') process.stdout.write('>cm shell\nCommandResult 0\nstill the comment\nCommandResult 0\n');
  else if (command === 'pause') {
    process.stdout.write('2026-09-25T10:');
    setTimeout(() => process.stdout.write('11:12\nCommandResult 0\n'), 200);
  } else if (command === 'prompt') {
    process.stdout.write('Select your system [0-1]: ');
    waitingForAnswer = true;
  } else if (command === 'exit') process.exit(0);
});
