import { join, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { RepositorySummary } from '@shared/domain/repository';
import {
  downloadCards,
  initialRepositoryName,
  kindForDownloads,
  newWorkspaceFormOf,
  repositoriesToName,
  serverToList,
  toggledKind,
  type NewWorkspaceFormInput,
} from './newWorkspaceForm';

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
  dynamicAvailable: false,
  kindChosen: 'standard',
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
        offersDynamic: false,
        dynamic: false,
        dynamicDisabled: false,
        partialAllowed: true,
        partial: false,
        downloads: 'branch',
        kind: 'standard',
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

describe('newWorkspaceFormOf: the dynamic choice', () => {
  const inGame = { ...input, repositoryName: 'game' };

  it('is offered only where this computer can create dynamic workspaces', () => {
    expect(newWorkspaceFormOf({ ...inGame, dynamicAvailable: true })).toMatchObject({ offersDynamic: true, dynamic: false });
    expect(newWorkspaceFormOf(inGame)).toMatchObject({ offersDynamic: false, dynamic: false });
  });

  it('makes the workspace dynamic when ticked', () => {
    expect(newWorkspaceFormOf({ ...inGame, dynamicAvailable: true, kindChosen: 'dynamic' })).toMatchObject({ dynamic: true, kind: 'dynamic', canCreate: true });
  });

  it('is offered with a new repository too, which a dynamic workspace can start on', () => {
    expect(newWorkspaceFormOf({ ...input, repositoryName: 'jump', dynamicAvailable: true, kindChosen: 'dynamic' })).toMatchObject({ createsRepository: true, dynamic: true });
  });

  it("doesn't make the workspace dynamic when ticked but no longer offered", () => {
    expect(newWorkspaceFormOf({ ...inGame, dynamicAvailable: false, kindChosen: 'dynamic' })).toMatchObject({ offersDynamic: false, dynamic: false, kind: 'standard' });
  });
});

describe('newWorkspaceFormOf: what to download', () => {
  const inGame: NewWorkspaceFormInput = { ...input, repositoryName: 'game' };

  it('downloads the whole branch until the user picks otherwise', () => {
    expect(newWorkspaceFormOf(inGame)).toMatchObject({ downloads: 'branch', partial: false, kind: 'standard' });
  });

  it('lets the user pick folders of a repository that exists, and before naming one, so the choice reads the same from the start', () => {
    expect(newWorkspaceFormOf(inGame)).toMatchObject({ partialAllowed: true });
    expect(newWorkspaceFormOf(input)).toMatchObject({ partialAllowed: true });
  });

  it("doesn't for a new repository, which has nothing to pick: the workspace gets the whole branch", () => {
    expect(newWorkspaceFormOf({ ...input, repositoryName: 'jump', kindChosen: 'partial' })).toMatchObject({
      partialAllowed: false,
      partial: false,
      downloads: 'branch',
      kind: 'standard',
    });
  });

  it('makes the workspace partial, not dynamic, when folders are picked, ready to create: which ones is chosen after', () => {
    expect(newWorkspaceFormOf({ ...inGame, dynamicAvailable: true, kindChosen: 'partial' })).toMatchObject({
      downloads: 'folders',
      partial: true,
      dynamic: false,
      kind: 'partial',
      canCreate: true,
    });
  });

  it('greys the dynamic choice while folders are picked: a dynamic workspace has the whole branch', () => {
    expect(newWorkspaceFormOf({ ...inGame, dynamicAvailable: true, kindChosen: 'partial' })).toMatchObject({ dynamicDisabled: true });
    expect(newWorkspaceFormOf({ ...inGame, dynamicAvailable: true, kindChosen: 'dynamic' })).toMatchObject({ dynamicDisabled: false, downloads: 'branch' });
  });
});

describe('kindForDownloads', () => {
  it('makes any kind partial when folders are picked', () => {
    expect(kindForDownloads('standard', 'folders')).toBe('partial');
    expect(kindForDownloads('dynamic', 'folders')).toBe('partial');
  });

  it('makes a partial choice standard when the whole branch is picked, and keeps a dynamic one, which has the whole branch', () => {
    expect(kindForDownloads('partial', 'branch')).toBe('standard');
    expect(kindForDownloads('dynamic', 'branch')).toBe('dynamic');
    expect(kindForDownloads('standard', 'branch')).toBe('standard');
  });
});

describe('downloadCards', () => {
  it('offers the whole branch first, then picking folders', () => {
    const cards = downloadCards({ partialAllowed: true });
    expect(cards.map((card) => [card.value, card.disabled ?? false])).toEqual([
      ['branch', false],
      ['folders', false],
    ]);
  });

  it('warns, on picking folders, that merging needs the whole branch', () => {
    const [, folders] = downloadCards({ partialAllowed: true });
    expect(folders.description).toMatch(/merg/i);
  });

  it('greys picking folders for a new repository and says why instead', () => {
    const [, allowed] = downloadCards({ partialAllowed: true });
    const [branch, folders] = downloadCards({ partialAllowed: false });
    expect(branch.disabled ?? false).toBe(false);
    expect(folders.disabled).toBe(true);
    expect(folders.description).not.toBe(allowed.description);
  });
});

describe('toggledKind', () => {
  it('takes the kind ticked, leaving the other one', () => {
    expect(toggledKind('standard', 'partial', true)).toBe('partial');
    expect(toggledKind('dynamic', 'partial', true)).toBe('partial');
    expect(toggledKind('partial', 'dynamic', true)).toBe('dynamic');
  });

  it('goes back to standard when the kind chosen is unticked', () => {
    expect(toggledKind('partial', 'partial', false)).toBe('standard');
    expect(toggledKind('dynamic', 'dynamic', false)).toBe('standard');
  });

  it('keeps the kind chosen when another one is unticked', () => {
    expect(toggledKind('dynamic', 'partial', false)).toBe('dynamic');
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
