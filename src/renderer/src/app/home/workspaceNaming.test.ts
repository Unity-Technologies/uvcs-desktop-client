import { describe, expect, it } from 'vitest';
import { defaultWorkspacePath, isRepositoryNameTaken, isWorkspaceNameTaken, repositoryNamed, repositoryNamedButForCase, suggestWorkspaceName } from './workspaceNaming';

describe('suggestWorkspaceName', () => {
  it('uses the last segment of sub-repository names', () => {
    expect(suggestWorkspaceName('acme/mergetool', [])).toBe('mergetool');
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

describe('repositoryNamed', () => {
  const repositories = [{ name: 'game' }, { name: 'acme/tools' }];

  it('is the repository of the name as typed, without its surrounding spaces, by case as cm tells them apart', () => {
    expect(repositoryNamed(' acme/tools ', repositories)).toEqual({ name: 'acme/tools' });
    expect(repositoryNamed('Game', repositories)).toBeUndefined();
    expect(repositoryNamed('', repositories)).toBeUndefined();
  });
});

describe('repositoryNamedButForCase', () => {
  const repositories = [{ name: 'game' }, { name: 'Game' }, { name: 'tools' }];

  it('is a repository whose name differs only by case', () => {
    expect(repositoryNamedButForCase('TOOLS ', repositories)).toEqual({ name: 'tools' });
    expect(repositoryNamedButForCase('GAME', repositories)).toEqual({ name: 'game' });
  });

  it('is none for the exact name, or one that differs by more than case', () => {
    expect(repositoryNamedButForCase('tools', repositories)).toBeUndefined();
    expect(repositoryNamedButForCase('tool', repositories)).toBeUndefined();
  });

  it('skips the exact match to find one that differs only by case', () => {
    expect(repositoryNamedButForCase('Game', repositories)).toEqual({ name: 'game' });
  });
});

describe('isWorkspaceNameTaken', () => {
  it('finds another workspace by the name, whatever its case and the spaces typed around it', () => {
    expect(isWorkspaceNameTaken(' Game ', ['game', 'tools'])).toBe(true);
    expect(isWorkspaceNameTaken('engine', ['game', 'tools'])).toBe(false);
  });

  it("lets a workspace being renamed change its own name's case", () => {
    expect(isWorkspaceNameTaken('Game', ['game', 'tools'], 'game')).toBe(false);
    expect(isWorkspaceNameTaken('tools', ['game', 'tools'], 'game')).toBe(true);
  });
});
