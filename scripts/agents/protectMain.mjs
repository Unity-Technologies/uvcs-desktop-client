#!/usr/bin/env node
// A Claude Code PreToolUse hook (wired in .claude/settings.json) that stops an agent from writing to `main` with git
// (what it refuses: protectMainRules.mjs). Work reaches main only through a pull request (CLAUDE.md "Delivering work:
// a pull request"); an agent once merged its branch into main locally, which the rule alone didn't prevent.
//
// It reads the hook's JSON on stdin ({ tool_input: { command }, cwd }) and, to refuse, prints a `deny` decision.
// Anything it can't read, it lets through: the hook is a seatbelt for honest mistakes, not a sandbox.
//
// This file only runs; it exports nothing. An "am I the entry point?" check (`import.meta.url` against
// `process.argv[1]`) was rejected: Node resolves symlinks in one and not the other, so the hook switched itself off,
// silently, whenever $CLAUDE_PROJECT_DIR went through a symlink, a junction or a mapped drive.

import { checkedOutBranch, mainBranchViolation } from './protectMainRules.mjs';

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
    `request"): commit on a <kind>/<topic> branch, push that branch and open a PR with \`gh pr create\`. To bring ` +
    `main up to date: \`git pull --ff-only\`.`;
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason },
    }),
  );
}

// A broken hook must never stop the agent's work: on any error, let the command through.
main().catch(() => {});
