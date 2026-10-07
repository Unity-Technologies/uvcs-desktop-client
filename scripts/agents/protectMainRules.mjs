// What the protectMain hook (protectMain.mjs) refuses: no commit, merge, pull, rebase, cherry-pick, revert or am
// while `main` is checked out, but for a fast-forward to `origin/main`, and no push to `main`. It follows `cd <dir>`, `git -C <dir>` and `git switch`/`git checkout`
// inside one command line, so `git checkout main && git merge feature/x` is caught before it runs. Pure but for
// `checkedOutBranch`, so the tests feed it command lines and branches.
//
// It reads command lines, not a full shell: these get through unseen (fail open), and that is accepted:
// `bash -c "..."`, subshells `( ... )`, `--git-dir=`, `cd ~/...` or `cd "$VAR"`, Git Bash paths (`cd /c/Users/...`),
// `git branch -f main`, `git update-ref refs/heads/main` and `git reset` on main.

import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const PROTECTED_BRANCH = 'main';
const WRITING_SUBCOMMANDS = new Set(['commit', 'merge', 'pull', 'rebase', 'cherry-pick', 'revert', 'am']);
/** What a fast-forward may name and still only bring main up to date with the remote's (`git pull --ff-only origin main`). */
const UPSTREAM_OF_MAIN = new Set(['origin', PROTECTED_BRANCH, `origin/${PROTECTED_BRANCH}`, '@{u}', '@{upstream}']);
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
    if (WRITING_SUBCOMMANDS.has(subcommand) && !backsOut(args) && !fastForwardsToUpstream(subcommand, args)) {
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

function backsOut(args) {
  return args.some((arg) => BACKING_OUT_OPTIONS.has(arg));
}

/** Whether a pull or merge only fast-forwards main to the remote's main: how main is brought up to date. */
function fastForwardsToUpstream(subcommand, args) {
  if (subcommand !== 'pull' && subcommand !== 'merge') return false;
  if (!args.includes('--ff-only')) return false;
  return args.filter((arg) => !arg.startsWith('-')).every((arg) => UPSTREAM_OF_MAIN.has(arg));
}

/** The parts of a command line that run one after another: split on unquoted `&&`, `||`, `;`, `|` and new lines. */
export function splitCommandLine(commandLine) {
  const command = withoutHeredocBodies(commandLine);
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

/**
 * The command line without the bodies of its heredocs (`<<'EOF'` ... `EOF`), the usual way an agent hands git a
 * commit message: its lines are text, and one starting with "git push origin main" must not read as a command.
 */
function withoutHeredocBodies(command) {
  const lines = [];
  let pendingDelimiters = [];
  let quote = null;
  const allLines = command.split('\n');
  for (let lineIndex = 0; lineIndex < allLines.length; lineIndex++) {
    const line = allLines[lineIndex];
    lines.push(line);
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (quote) {
        if (char === quote) quote = null;
      } else if (char === '"' || char === "'") {
        quote = char;
      } else if (line.startsWith('<<', i) && line[i + 2] !== '<') {
        const heredoc = /^<<-?\s*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\1/.exec(line.slice(i));
        if (heredoc) {
          pendingDelimiters.push(heredoc[2]);
          i += heredoc[0].length - 1;
        }
      }
    }
    for (const delimiter of pendingDelimiters) {
      while (lineIndex + 1 < allLines.length && allLines[lineIndex + 1].trim() !== delimiter) lineIndex++;
      lineIndex++;
    }
    pendingDelimiters = [];
  }
  return lines.join('\n');
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

export function checkedOutBranch(dir) {
  try {
    return execFileSync('git', ['-C', dir, 'rev-parse', '--abbrev-ref', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
}
