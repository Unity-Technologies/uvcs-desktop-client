#!/usr/bin/env node
// Stands in for `cm shell` in tests. Commands: `echo <text>`, `fail`, `prompt` (asks a question and waits).
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
  if (command === 'echo') process.stdout.write(`${rest.join(' ')}\nCommandResult 0\n`);
  else if (command === 'fail') process.stdout.write('Something went wrong\nCommandResult 1\n');
  else if (command === 'prompt') {
    process.stdout.write('Select your system [0-1]: ');
    waitingForAnswer = true;
  } else if (command === 'exit') process.exit(0);
});
