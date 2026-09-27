import { describe, expect, it } from 'vitest';
import { defaultWorkspacePath, isRepositoryNameTaken, suggestWorkspaceName } from './workspaceNaming';

describe('suggestWorkspaceName', () => {
  it('uses the last segment of sub-repository names', () => {
    expect(suggestWorkspaceName('codice/unitymerge', [])).toBe('unitymerge');
  });

  it('adds a numeric suffix when the name is taken', () => {
    expect(suggestWorkspaceName('game', ['Game', 'game-2'])).toBe('game-3');
  });
});

describe('defaultWorkspacePath', () => {
  it('puts the workspace in a folder named after it', () => {
    expect(defaultWorkspacePath('/Users/me', 'game')).toBe('/Users/me/game');
  });

  it('names the folder without the spaces typed around the name', () => {
    expect(defaultWorkspacePath('/Users/me', '  game ')).toBe('/Users/me/game');
  });

  it('has no path until the root and a name are known', () => {
    expect(defaultWorkspacePath(undefined, 'game')).toBe('');
    expect(defaultWorkspacePath('/Users/me', '   ')).toBe('');
  });
});

describe('isRepositoryNameTaken', () => {
  it('finds the name as typed, without its surrounding spaces', () => {
    expect(isRepositoryNameTaken(' game ', ['game', 'tools'])).toBe(true);
    expect(isRepositoryNameTaken('engine', ['game', 'tools'])).toBe(false);
  });

  it('tells names apart by case, as cm does', () => {
    expect(isRepositoryNameTaken('Game', ['game'])).toBe(false);
  });
});
