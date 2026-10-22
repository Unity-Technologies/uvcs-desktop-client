import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { chosenRepositoryName, workspaceNameShown, workspaceRepositoryOf } from './newWorkspaceForm';

const choice = { source: 'existing' as const, existingSpec: undefined, newServer: 'local', newName: '', newNameTaken: false, created: undefined };

describe('workspaceRepositoryOf', () => {
  it('is the repository picked, once one is', () => {
    expect(workspaceRepositoryOf(choice)).toBeUndefined();
    expect(workspaceRepositoryOf({ ...choice, existingSpec: 'game@local' })).toEqual({ kind: 'existing', spec: 'game@local' });
  });

  it('is a repository to create on the server chosen, named as typed without the spaces around', () => {
    expect(workspaceRepositoryOf({ ...choice, source: 'new', newServer: 'acme@cloud', newName: '  game ' })).toEqual({
      kind: 'new',
      server: 'acme@cloud',
      name: 'game',
    });
  });

  it('ignores the other source', () => {
    expect(workspaceRepositoryOf({ ...choice, source: 'new', existingSpec: 'game@local' })).toBeUndefined();
    expect(workspaceRepositoryOf({ ...choice, newName: 'game' })).toBeUndefined();
  });

  it('names no repository to create without a name, or with one already taken', () => {
    expect(workspaceRepositoryOf({ ...choice, source: 'new', newName: '   ' })).toBeUndefined();
    expect(workspaceRepositoryOf({ ...choice, source: 'new', newName: 'game', newNameTaken: true })).toBeUndefined();
  });

  it('keeps the repository an earlier try created, though its name now shows as taken', () => {
    expect(workspaceRepositoryOf({ ...choice, source: 'new', newName: 'game', newNameTaken: true, created: 'game@local' })).toEqual({
      kind: 'new',
      server: 'local',
      name: 'game',
      created: 'game@local',
    });
  });
});

describe('workspaceNameShown', () => {
  const sources = { typed: undefined, initialPath: undefined, repositoryName: '', takenNames: [] };

  it('is empty until there is a repository to name it after', () => {
    expect(workspaceNameShown(sources)).toBe('');
    expect(workspaceNameShown({ ...sources, repositoryName: '  ' })).toBe('');
  });

  it('follows the repository, made unique among the workspaces', () => {
    expect(workspaceNameShown({ ...sources, repositoryName: 'acme/game ' })).toBe('game');
    expect(workspaceNameShown({ ...sources, repositoryName: 'game', takenNames: ['Game'] })).toBe('game-2');
  });

  it("is the folder's name when the dialog opened with one", () => {
    expect(workspaceNameShown({ ...sources, initialPath: join('projects', 'jump'), repositoryName: 'game' })).toBe('jump');
  });

  it('is what the user typed, even empty', () => {
    expect(workspaceNameShown({ ...sources, typed: 'mine', initialPath: join('projects', 'jump'), repositoryName: 'game' })).toBe('mine');
    expect(workspaceNameShown({ ...sources, typed: '', repositoryName: 'game' })).toBe('');
  });
});

describe('chosenRepositoryName', () => {
  it('is the name of the repository picked, or of the one to create', () => {
    expect(chosenRepositoryName({ source: 'existing', existingName: 'game', newName: 'jump' })).toBe('game');
    expect(chosenRepositoryName({ source: 'existing', existingName: undefined, newName: 'jump' })).toBe('');
    expect(chosenRepositoryName({ source: 'new', existingName: 'game', newName: 'jump' })).toBe('jump');
  });
});
