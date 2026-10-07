import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const AGENTS_FOLDER = __dirname;
const PUSH_TO_MAIN = { tool_name: 'Bash', tool_input: { command: 'git push origin main' }, cwd: AGENTS_FOLDER };

/** The part of `.claude/settings.json` that wires hooks. */
interface HookSettings {
  hooks: { PreToolUse: { matcher: string; hooks: { command: string }[] }[] };
}

/** Runs the hook as Claude Code does: its JSON on stdin, its decision on stdout. */
function runHook(script: string, input: string): { stdout: string; status: number | null } {
  const { stdout, status } = spawnSync(process.execPath, [script], { input, encoding: 'utf8' });
  return { stdout, status };
}

function decision(stdout: string): string | undefined {
  return stdout ? JSON.parse(stdout).hookSpecificOutput?.permissionDecision : undefined;
}

describe('the protectMain hook, run as Claude Code runs it', () => {
  it('runs before every Bash command, as the project settings say', () => {
    const settingsFile = join(AGENTS_FOLDER, '..', '..', '.claude', 'settings.json');
    const settings: HookSettings = JSON.parse(readFileSync(settingsFile, 'utf8'));
    const commands = settings.hooks.PreToolUse.filter((entry) => entry.matcher.split('|').includes('Bash')).flatMap(
      (entry) => entry.hooks.map((hook) => hook.command),
    );
    expect(commands).toContain('node "$CLAUDE_PROJECT_DIR/scripts/agents/protectMain.mjs"');
  });

  it('denies a push to main', () => {
    const { stdout, status } = runHook(join(AGENTS_FOLDER, 'protectMain.mjs'), JSON.stringify(PUSH_TO_MAIN));
    expect(status).toBe(0);
    expect(decision(stdout)).toBe('deny');
  });

  // $CLAUDE_PROJECT_DIR can reach the script through a symlinked folder (on Windows a junction, a subst or mapped
  // drive): the hook must not take itself for an import there and silently let everything through.
  it('denies it when reached through a symlinked folder', () => {
    const linkedFolder = join(mkdtempSync(join(tmpdir(), 'protect-main-')), 'agents');
    symlinkSync(AGENTS_FOLDER, linkedFolder, 'junction');
    const { stdout } = runHook(join(linkedFolder, 'protectMain.mjs'), JSON.stringify(PUSH_TO_MAIN));
    expect(decision(stdout)).toBe('deny');
  });

  it('lets the command through when its input is unreadable', () => {
    const { stdout, status } = runHook(join(AGENTS_FOLDER, 'protectMain.mjs'), 'not json');
    expect(status).toBe(0);
    expect(stdout).toBe('');
  });
});
