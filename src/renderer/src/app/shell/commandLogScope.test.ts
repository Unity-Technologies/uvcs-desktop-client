import { describe, expect, it } from 'vitest';
import type { CommandLogEntry } from '@shared/events';
import { ranInWorkspace } from './commandLogScope';

const entryIn = (cwd: string): CommandLogEntry => ({
  id: 1,
  commandLine: 'cm status',
  cwd,
  startedAt: 0,
  durationMs: 1,
  exitCode: 0,
  viaShell: true,
  output: '',
});

describe('ranInWorkspace', () => {
  it('matches commands run in the workspace or one of its folders', () => {
    expect(ranInWorkspace(entryIn('/work/game'), '/work/game')).toBe(true);
    expect(ranInWorkspace(entryIn('/work/game/src'), '/work/game/')).toBe(true);
    expect(ranInWorkspace(entryIn('C:\\work\\game\\src'), 'C:\\work\\game')).toBe(true);
  });

  it('skips commands run elsewhere, even in a folder with the same prefix', () => {
    expect(ranInWorkspace(entryIn('/Users/me'), '/work/game')).toBe(false);
    expect(ranInWorkspace(entryIn('/work/game-old'), '/work/game')).toBe(false);
  });
});
