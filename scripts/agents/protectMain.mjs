#!/usr/bin/env node
// A Claude Code PreToolUse hook (wired in .claude/settings.json) that stops an agent from writing to `main` with git:
// no commit, merge, rebase, cherry-pick, revert or am while `main` is checked out, and no push to `main`. Work reaches
// main only through a pull request (CLAUDE.md "Delivering work: a pull request"); an agent once merged its branch into
// main locally, which the rule alone didn't prevent.
//
// It reads the hook's JSON on stdin ({ tool_input: { command }, cwd }) and, to refuse, prints a `deny` decision. It
// follows `cd <dir>`, `git -C <dir>` and `git switch`/`git checkout` inside one command line, so
// `git checkout main && git merge feature/x` is caught before it runs. Anything it can't read, it lets through: the
// hook is a seatbelt for honest mistakes, not a sandbox.

import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const PROTECTED_BRANCH = 'main';
const WRITING_SUBCOMMANDS = new Set(['commit', 'merge', 'rebase', 'cherry-pick', 'revert', 'am']);
/** Options that only stop or inspect an operation already under way, which is how an agent backs out of a mistake. */
const BACKING_OUT_OPTIONS = new Set(['--abort', '--quit', '--show-current-patch']);
/** git's own options that take a value as the next word (`git -C <dir> ...`, `git -c key=value ...`). */
const GIT_OPTIONS_WITH_VALUE = new Set(['-C', '-c', '--git-dir', '--work-tree', '--namespace']);

/**
 * Why `command`, run in `cwd`, would write to main, or null when it wouldn't.
 * `branchIn(dir)` answers the branch checked out in `dir` (null when unknown).
 */
export function mainBranchViolation(command, cwd, branchIn) {
  let directory = cwd;
  /** Branches this command line itself switches to before a later part runs, by directory. */
  const switchedTo = new Map();
  const branchAt = (dir) => (switchedTo.has(dir) ? switchedTo.get(dir) : branchIn(dir));

  for (const segment of splitCommandLine(command)) {
    const words = withoutEnvironmentAssignments(shellWords(segment));
    if (words[0] === 'cd' && words[1]) {
      directory = resolve(directory, words[1]);
      continue;
    }
    if (words[0] !== 'git') continue;

    const { gitDirectory, subcommand, args } = readGitInvocation(words.slice(1), directory);
    const switched = branchSwitchedTo(subcommand, args);
    if (switched) {
      switchedTo.set(gitDirectory, switched);
      continue;
    }
    if (WRITING_SUBCOMMANDS.has(subcommand) && !args.some((arg) => BACKING_OUT_OPTIONS.has(arg))) {
      if (branchAt(gitDirectory) === PROTECTED_BRANCH) {
        return `\`git ${subcommand}\` on ${PROTECTED_BRANCH}`;
      }
    }
    if (subcommand === 'push' && pushesToMain(args, branchAt(gitDirectory))) {
      return `\`git push\` to ${PROTECTED_BRANCH}`;
    }
  }
  return null;
}

/** The parts of a command line that run one after another: split on unquoted `&&`, `||`, `;`, `|` and new lines. */
export function splitCommandLine(command) {
  const segments = [];
  let current = '';
  let quote = null;
  for (let i = 0; i < command.length; i++) {
    const char = command[i];
    if (quote) {
      if (char === quote) quote = null;
      current += char;
    } else if (char === '"' || char === "'") {
      quote = char;
      current += char;
    } else if (char === ';' || char === '\n' || char === '|' || (char === '&' && command[i + 1] === '&')) {
      if (command[i + 1] === char) i++;
      segments.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  segments.push(current);
  return segments.map((segment) => segment.trim()).filter(Boolean);
}

/** A segment's words, unquoted: enough for git's arguments, not a full shell parser. */
export function shellWords(segment) {
  const words = [];
  let current = '';
  let inWord = false;
  let quote = null;
  for (const char of segment) {
    if (quote) {
      if (char === quote) quote = null;
      else current += char;
    } else if (char === '"' || char === "'") {
      quote = char;
      inWord = true;
    } else if (/\s/.test(char)) {
      if (inWord) words.push(current);
      current = '';
      inWord = false;
    } else {
      current += char;
      inWord = true;
    }
  }
  if (inWord) words.push(current);
  return words;
}

function withoutEnvironmentAssignments(words) {
  const firstCommand = words.findIndex((word) => !/^[A-Za-z_][A-Za-z0-9_]*=/.test(word));
  return firstCommand === -1 ? [] : words.slice(firstCommand);
}

function readGitInvocation(words, directory) {
  let gitDirectory = directory;
  let i = 0;
  while (i < words.length && words[i].startsWith('-')) {
    if (words[i] === '-C') gitDirectory = resolve(gitDirectory, words[i + 1] ?? '.');
    i += GIT_OPTIONS_WITH_VALUE.has(words[i]) ? 2 : 1;
  }
  return { gitDirectory, subcommand: words[i], args: words.slice(i + 1) };
}

/** The branch `git switch` or `git checkout` moves to, or null when it moves nowhere we can tell (files, `-`). */
function branchSwitchedTo(subcommand, args) {
  if (subcommand !== 'switch' && subcommand !== 'checkout') return null;
  if (args.includes('--')) return null;
  const creates = args.findIndex((arg) => ['-b', '-B', '-c', '-C', '--create', '--force-create'].includes(arg));
  if (creates !== -1) return args[creates + 1] ?? null;
  const positionals = args.filter((arg) => !arg.startsWith('-'));
  return positionals.length === 1 && positionals[0] !== '-' ? positionals[0] : null;
}

/** Whether `git push <args>`, run with `currentBranch` checked out, updates main on the remote. */
function pushesToMain(args, currentBranch) {
  if (args.includes('--all') || args.includes('--mirror')) return true;
  const [, ...refspecs] = args.filter((arg) => !arg.startsWith('-'));
  if (refspecs.length === 0) return currentBranch === PROTECTED_BRANCH;
  return refspecs.some((refspec) => {
    const destination = refspec.replace(/^\+/, '').split(':').pop();
    const branch = destination === 'HEAD' || destination === '' ? currentBranch : destination;
    return branch === PROTECTED_BRANCH || branch === `refs/heads/${PROTECTED_BRANCH}`;
  });
}

function checkedOutBranch(dir) {
  try {
    return execFileSync('git', ['-C', dir, 'rev-parse', '--abbrev-ref', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
}

function readStdin() {
  return new Promise((resolveInput) => {
    let input = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => (input += chunk));
    process.stdin.on('end', () => resolveInput(input));
  });
}

async function main() {
  const hookInput = JSON.parse(await readStdin());
  const command = hookInput.tool_input?.command;
  if (typeof command !== 'string') return;
  const violation = mainBranchViolation(command, hookInput.cwd ?? process.cwd(), checkedOutBranch);
  if (!violation) return;
  const reason =
    `Blocked: ${violation}. Work reaches main only through a pull request (CLAUDE.md "Delivering work: a pull ` +
    `request"): commit on a <kind>/<topic> branch, push that branch and open a PR with \`gh pr create\`.`;
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason },
    }),
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  // A broken hook must never stop the agent's work: on any error, let the command through.
  main().catch(() => {});
}
