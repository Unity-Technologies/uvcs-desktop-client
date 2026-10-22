import { commandFailure, fakeApi } from '../../../testing/fakeWindow';
import { describe, expect, it, vi } from 'vitest';
import { shownToasts } from '../../../testing/operationOutcome';
import { createNewWorkspace } from './createNewWorkspace';

const name = 'game';
const path = '/Users/me/wkspaces/game';
const created = { name, path, guid: 'g' };
const newRepository = { kind: 'new' as const, server: 'acme@cloud', name: 'game' };

describe('createNewWorkspace', () => {
  describe('in an existing repository', () => {
    it('creates the workspace, opens it and updates it', async () => {
      const open = vi.fn();
      fakeApi.answer('workspaces.create', () => created);
      fakeApi.answer('workspaces.update', () => undefined);

      const outcome = await createNewWorkspace({ name, path, repository: { kind: 'existing', spec: 'game@local' } }, open);

      expect(outcome).toEqual({ kind: 'opened' });
      expect(fakeApi.methods()).toEqual(['workspaces.create', 'workspaces.update']);
      expect(fakeApi.argsOf('workspaces.create')).toEqual([[{ name, path, repository: 'game@local' }]]);
      expect(open).toHaveBeenCalledWith(path);
    });

    it('says the workspace failed, and opens nothing', async () => {
      const open = vi.fn();
      fakeApi.answer('workspaces.create', () => {
        throw commandFailure('The workspace name is already in use');
      });

      const outcome = await createNewWorkspace({ name, path, repository: { kind: 'existing', spec: 'game@local' } }, open);

      expect(outcome).toMatchObject({ kind: 'failed', title: "Couldn't create the workspace" });
      expect(open).not.toHaveBeenCalled();
    });
  });

  describe('with a new repository', () => {
    it('creates the repository, then a workspace of it, and opens it without an update: it has no files yet', async () => {
      const open = vi.fn();
      fakeApi.answer('repositories.create', () => 'game@acme@cloud');
      fakeApi.answer('workspaces.create', () => created);

      const outcome = await createNewWorkspace({ name, path, repository: newRepository }, open);

      expect(outcome).toEqual({ kind: 'opened' });
      expect(fakeApi.methods()).toEqual(['repositories.create', 'workspaces.create']);
      expect(fakeApi.argsOf('repositories.create')).toEqual([['acme@cloud', 'game']]);
      expect(fakeApi.argsOf('workspaces.create')).toEqual([[{ name, path, repository: 'game@acme@cloud' }]]);
      expect(open).toHaveBeenCalledWith(path);
      expect(shownToasts()).toEqual([]);
    });

    it('makes only the workspace once an earlier try made the repository', async () => {
      fakeApi.answer('workspaces.create', () => created);

      await createNewWorkspace({ name, path, repository: { ...newRepository, created: 'game@acme@cloud' } }, () => {});

      expect(fakeApi.argsOf('workspaces.create')).toEqual([[{ name, path, repository: 'game@acme@cloud' }]]);
      expect(fakeApi.methods()).toEqual(['workspaces.create']);
    });

    it('passes a failure on, naming the repository made, and opens nothing', async () => {
      const open = vi.fn();
      fakeApi.answer('repositories.create', () => 'game@acme@cloud');
      fakeApi.answer('workspaces.create', () => {
        throw commandFailure('The path is already in use');
      });

      const outcome = await createNewWorkspace({ name, path, repository: newRepository }, open);

      expect(outcome).toMatchObject({ kind: 'failed', title: 'Created game, but not its workspace', createdRepository: 'game@acme@cloud' });
      expect(open).not.toHaveBeenCalled();
    });
  });
});
