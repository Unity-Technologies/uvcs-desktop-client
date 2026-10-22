import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { newWorkspaceFormOf, serverToList, typedNameAfterPicking, type NewWorkspaceFormInput } from './newWorkspaceForm';

const root = join('Users', 'me', 'wkspaces');
const game = { spec: 'game@local', name: 'game' };

const input: NewWorkspaceFormInput = {
  source: 'existing',
  server: 'local',
  existing: undefined,
  newName: '',
  repositoryNames: [],
  created: undefined,
  typedName: undefined,
  initialPath: undefined,
  workspaceNames: [],
  chosenPath: undefined,
  root,
  creating: false,
};

describe('newWorkspaceFormOf', () => {
  describe('with an existing repository', () => {
    it('waits for a repository to be picked', () => {
      expect(newWorkspaceFormOf(input)).toMatchObject({ repository: undefined, workspaceName: '', path: '', canCreate: false });
    });

    it("works with the repository picked, naming the workspace after it in the workspaces' folder", () => {
      expect(newWorkspaceFormOf({ ...input, existing: game })).toEqual({
        repository: { kind: 'existing', spec: 'game@local' },
        workspaceName: 'game',
        workspaceNameTaken: false,
        path: join(root, 'game'),
        showsRepositoryNameTaken: false,
        choiceLocked: false,
        canCreate: true,
      });
    });

    it('forgets the repository picked once another server shows, as the picker does', () => {
      expect(newWorkspaceFormOf({ ...input, existing: game, server: 'acme@cloud' })).toMatchObject({ repository: undefined, workspaceName: '', canCreate: false });
    });
  });

  describe('with a new repository', () => {
    const creating = { ...input, source: 'new' as const, server: 'acme@cloud' };

    it('creates it on the server shown, named as typed without the spaces around, and names the workspace after it', () => {
      expect(newWorkspaceFormOf({ ...creating, newName: ' acme/game ' })).toMatchObject({
        repository: { kind: 'new', server: 'acme@cloud', name: 'acme/game' },
        workspaceName: 'game',
        path: join(root, 'game'),
        canCreate: true,
      });
    });

    it('ignores a repository picked before switching', () => {
      expect(newWorkspaceFormOf({ ...creating, existing: game })).toMatchObject({ repository: undefined, canCreate: false });
    });

    it('needs a name', () => {
      expect(newWorkspaceFormOf({ ...creating, newName: '   ' })).toMatchObject({ repository: undefined, canCreate: false });
    });

    it('says a name the server already has is taken, telling names apart by case as cm does', () => {
      expect(newWorkspaceFormOf({ ...creating, newName: 'game', repositoryNames: ['game'] })).toMatchObject({
        repository: undefined,
        showsRepositoryNameTaken: true,
        canCreate: false,
      });
      expect(newWorkspaceFormOf({ ...creating, newName: 'Game', repositoryNames: ['game'] })).toMatchObject({ showsRepositoryNameTaken: false, canCreate: true });
    });

    it('keeps a repository an earlier try made, locks the choice and shows no taken name, though the server now lists it', () => {
      expect(newWorkspaceFormOf({ ...creating, newName: 'game', repositoryNames: ['game'], created: 'game@acme@cloud' })).toMatchObject({
        repository: { kind: 'new', server: 'acme@cloud', name: 'game', created: 'game@acme@cloud' },
        showsRepositoryNameTaken: false,
        choiceLocked: true,
        canCreate: true,
      });
    });

    it('shows no taken name while an existing repository is chosen', () => {
      expect(newWorkspaceFormOf({ ...input, newName: 'game', repositoryNames: ['game'] }).showsRepositoryNameTaken).toBe(false);
    });
  });

  describe('the workspace name and folder', () => {
    it('make the name unique among the workspaces, by case too', () => {
      expect(newWorkspaceFormOf({ ...input, existing: game, workspaceNames: ['Game'] }).workspaceName).toBe('game-2');
    });

    it("take a dropped folder's name and the folder itself", () => {
      const folder = join('projects', 'jump');
      expect(newWorkspaceFormOf({ ...input, existing: game, initialPath: folder, chosenPath: folder })).toMatchObject({ workspaceName: 'jump', path: folder });
    });

    it('take what the user typed, even empty, and a folder they chose', () => {
      const folder = join('elsewhere', 'mine');
      expect(newWorkspaceFormOf({ ...input, existing: game, typedName: 'mine', chosenPath: folder })).toMatchObject({ workspaceName: 'mine', path: folder });
      expect(newWorkspaceFormOf({ ...input, existing: game, typedName: '' })).toMatchObject({ workspaceName: '', path: '', canCreate: false });
    });

    it('refuse a name another workspace has', () => {
      expect(newWorkspaceFormOf({ ...input, existing: game, typedName: 'Jump', workspaceNames: ['jump'] })).toMatchObject({ workspaceNameTaken: true, canCreate: false });
    });

    it('wait for the folder for new workspaces to be known', () => {
      expect(newWorkspaceFormOf({ ...input, existing: game, root: undefined })).toMatchObject({ path: '', canCreate: false });
    });
  });

  it('allows no second Create while one runs', () => {
    expect(newWorkspaceFormOf({ ...input, existing: game, creating: true }).canCreate).toBe(false);
  });
});

describe('typedNameAfterPicking', () => {
  it('names the workspace afresh after the repository picked', () => {
    expect(typedNameAfterPicking('mine', undefined)).toBeUndefined();
  });

  it('keeps what the user typed when a folder named the workspace', () => {
    expect(typedNameAfterPicking('mine', join('projects', 'jump'))).toBe('mine');
  });
});

describe('serverToList', () => {
  it("reads the server's repositories, unless the caller fixed the repository", () => {
    expect(serverToList('acme@cloud', false)).toBe('acme@cloud');
    expect(serverToList('acme@cloud', true)).toBeNull();
  });
});
