import { join, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { RepositorySummary } from '@shared/domain/repository';
import { initialRepositoryName, newWorkspaceFormOf, repositoriesToName, serverToList, type NewWorkspaceFormInput } from './newWorkspaceForm';

const root = join('Users', 'me', 'wkspaces');
const repositoryOnServer = (name: string): RepositorySummary => ({ id: name, name, server: 'acme@cloud', owner: 'me', spec: `${name}@acme@cloud` });
const onServer = [repositoryOnServer('game'), repositoryOnServer('acme/tools')];

const input: NewWorkspaceFormInput = {
  server: 'acme@cloud',
  repositoryName: '',
  repositories: onServer,
  repositoriesFailed: false,
  created: undefined,
  typedName: undefined,
  initialPath: undefined,
  workspaceNames: [],
  chosenPath: undefined,
  root,
  creating: false,
};

describe('newWorkspaceFormOf', () => {
  describe('the repository', () => {
    it('waits for a name', () => {
      expect(newWorkspaceFormOf({ ...input, repositoryName: '  ' })).toMatchObject({ repository: undefined, createsRepository: false, canCreate: false });
    });

    it("is the server's repository of the name picked or typed, without the spaces around", () => {
      expect(newWorkspaceFormOf({ ...input, repositoryName: ' game ' })).toEqual({
        repository: { kind: 'existing', spec: 'game@acme@cloud' },
        repositoryList: 'ready',
        createsRepository: false,
        repositoryNote: undefined,
        repositoryLocked: false,
        workspaceName: 'game',
        workspaceNameTaken: false,
        path: join(root, 'game'),
        canCreate: true,
      });
    });

    it('is one to create on the server shown when the server has none of that name', () => {
      expect(newWorkspaceFormOf({ ...input, repositoryName: 'jump ' })).toMatchObject({
        repository: { kind: 'new', server: 'acme@cloud', name: 'jump' },
        createsRepository: true,
        repositoryNote: { kind: 'creates' },
        workspaceName: 'jump',
        canCreate: true,
      });
    });

    it('matches names by case, as cm tells them apart, and warns of the repository named like it but for case', () => {
      expect(newWorkspaceFormOf({ ...input, repositoryName: 'Game' })).toMatchObject({
        repository: { kind: 'new', server: 'acme@cloud', name: 'Game' },
        createsRepository: true,
        repositoryNote: { kind: 'differsByCase', existingName: 'game' },
      });
    });

    it("names none until the server's repositories are read: a name can't be told new before", () => {
      expect(newWorkspaceFormOf({ ...input, repositoryName: 'game', repositories: undefined })).toMatchObject({
        repositoryList: 'loading',
        repository: undefined,
        createsRepository: false,
        repositoryNote: undefined,
        canCreate: false,
      });
    });

    it('says the list failed rather than loading, and names nothing', () => {
      expect(newWorkspaceFormOf({ ...input, repositoryName: 'game', repositories: undefined, repositoriesFailed: true })).toMatchObject({
        repositoryList: 'failed',
        repository: undefined,
        canCreate: false,
      });
    });

    it('keeps the repository an earlier try made, and locks it, though the server now lists it', () => {
      const listed = [...onServer, repositoryOnServer('jump')];
      expect(newWorkspaceFormOf({ ...input, repositoryName: 'jump', repositories: listed, created: 'jump@acme@cloud' })).toMatchObject({
        repository: { kind: 'new', server: 'acme@cloud', name: 'jump', created: 'jump@acme@cloud' },
        createsRepository: false,
        repositoryNote: undefined,
        repositoryLocked: true,
        canCreate: true,
      });
    });
  });

  describe('the workspace name and folder', () => {
    it('follow the repository, its last part, made unique among the workspaces by case too', () => {
      expect(newWorkspaceFormOf({ ...input, repositoryName: 'acme/tools' }).workspaceName).toBe('tools');
      expect(newWorkspaceFormOf({ ...input, repositoryName: 'game', workspaceNames: ['Game'] }).workspaceName).toBe('game-2');
    });

    it("take a dropped folder's name and the folder itself", () => {
      const folder = join('projects', 'jump');
      expect(newWorkspaceFormOf({ ...input, repositoryName: 'game', initialPath: folder, chosenPath: folder })).toMatchObject({ workspaceName: 'jump', path: folder });
    });

    it('take what the user typed, even empty, and a folder they chose', () => {
      const folder = join('elsewhere', 'mine');
      expect(newWorkspaceFormOf({ ...input, repositoryName: 'game', typedName: 'mine', chosenPath: folder })).toMatchObject({ workspaceName: 'mine', path: folder });
      expect(newWorkspaceFormOf({ ...input, repositoryName: 'game', typedName: '' })).toMatchObject({ workspaceName: '', path: '', canCreate: false });
    });

    it('refuse a name another workspace has', () => {
      expect(newWorkspaceFormOf({ ...input, repositoryName: 'game', typedName: 'Jump', workspaceNames: ['jump'] })).toMatchObject({ workspaceNameTaken: true, canCreate: false });
    });

    it('wait for the folder for new workspaces to be known', () => {
      expect(newWorkspaceFormOf({ ...input, repositoryName: 'game', root: undefined })).toMatchObject({ path: '', canCreate: false });
    });
  });

  it('allows no second Create while one runs', () => {
    expect(newWorkspaceFormOf({ ...input, repositoryName: 'game', creating: true }).canCreate).toBe(false);
  });
});

describe('serverToList', () => {
  it("reads the server's repositories, unless the caller fixed the repository", () => {
    expect(serverToList('acme@cloud', undefined)).toBe('acme@cloud');
    expect(serverToList('acme@cloud', onServer[0])).toBeNull();
  });
});

describe('repositoriesToName', () => {
  it("is the repository the caller fixed, else the server's as read", () => {
    expect(repositoriesToName(onServer[0], undefined)).toEqual([onServer[0]]);
    expect(repositoriesToName(undefined, onServer)).toEqual(onServer);
    expect(repositoriesToName(undefined, undefined)).toBeUndefined();
  });

  it("names the fixed repository as it is, never one to create", () => {
    const fixed = repositoryOnServer('game');
    expect(newWorkspaceFormOf({ ...input, repositoryName: 'game', repositories: repositoriesToName(fixed, undefined) }).repository).toEqual({ kind: 'existing', spec: fixed.spec });
  });
});

describe('initialRepositoryName', () => {
  it("proposes a dropped folder's name for the repository, as for the workspace", () => {
    expect(initialRepositoryName(undefined, join('projects', 'jump'))).toBe('jump');
    expect(initialRepositoryName(undefined, `${join('projects', 'jump')}${sep}`)).toBe('jump');
  });

  it('is the repository the caller fixed, whatever the folder', () => {
    expect(initialRepositoryName(onServer[0], join('projects', 'jump'))).toBe('game');
  });

  it('is empty when the dialog opens with neither', () => {
    expect(initialRepositoryName(undefined, undefined)).toBe('');
  });

  it('names an existing repository when the folder is named like one, and one to create otherwise', () => {
    const fromFolder = (folder: string) => newWorkspaceFormOf({ ...input, repositoryName: initialRepositoryName(undefined, folder), initialPath: folder, chosenPath: folder });
    expect(fromFolder(join('projects', 'game'))).toMatchObject({ repository: { kind: 'existing', spec: 'game@acme@cloud' }, workspaceName: 'game' });
    expect(fromFolder(join('projects', 'jump'))).toMatchObject({ repository: { kind: 'new', name: 'jump' }, repositoryNote: { kind: 'creates' }, workspaceName: 'jump' });
  });
});
