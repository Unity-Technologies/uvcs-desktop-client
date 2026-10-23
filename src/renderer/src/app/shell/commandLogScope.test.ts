import { describe, expect, it } from 'vitest';
import { repositoryPlace, workspacePlace } from '@shared/domain/place';
import type { CommandLogEntry } from '@shared/events';
import { commandLogScopes, ranInPlace } from './commandLogScope';

const entryIn = (cwd: string, outsideWorkspaces?: true): CommandLogEntry => ({
  id: 1,
  commandLine: 'cm status',
  cwd,
  startedAt: 0,
  durationMs: 1,
  exitCode: 0,
  viaShell: true,
  ...(outsideWorkspaces && { outsideWorkspaces }),
  output: '',
});

describe('ranInPlace', () => {
  it('matches commands run in the workspace or one of its folders', () => {
    expect(ranInPlace(entryIn('/work/game'), workspacePlace('/work/game'))).toBe(true);
    expect(ranInPlace(entryIn('/work/game/src'), workspacePlace('/work/game/'))).toBe(true);
    expect(ranInPlace(entryIn('C:\\work\\game\\src'), workspacePlace('C:\\work\\game'))).toBe(true);
  });

  it('skips commands run elsewhere, even in a folder with the same prefix', () => {
    expect(ranInPlace(entryIn('/Users/me'), workspacePlace('/work/game'))).toBe(false);
    expect(ranInPlace(entryIn('/work/game-old'), workspacePlace('/work/game'))).toBe(false);
  });

  it("matches a repository explored without a workspace's commands, those run outside every workspace", () => {
    expect(ranInPlace(entryIn('/app/outside-workspaces', true), repositoryPlace('game@local'))).toBe(true);
    expect(ranInPlace(entryIn('/Users/me'), repositoryPlace('game@local'))).toBe(false);
    expect(ranInPlace(entryIn('/app/outside-workspaces', true), workspacePlace('/work/game'))).toBe(false);
  });
});

describe('commandLogScopes', () => {
  it("names the place's own scope after what the place is", () => {
    expect(commandLogScopes(workspacePlace('/work/game')).map(({ label }) => label)).toEqual(['This workspace', 'All']);
    expect(commandLogScopes(repositoryPlace('game@local')).map(({ label }) => label)).toEqual(['This repository', 'All']);
  });
});
