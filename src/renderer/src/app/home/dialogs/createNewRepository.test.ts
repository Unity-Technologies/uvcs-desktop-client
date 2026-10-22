import { commandFailure, fakeApi } from '../../../testing/fakeWindow';
import { describe, expect, it } from 'vitest';
import { queryKeys } from '../../../api/queryKeys';
import { queryClient } from '../../queryClient';
import { createNewRepository } from './createNewRepository';

const workspace = { name: 'game', path: '/Users/me/wkspaces/game' };
const created = { ...workspace, guid: 'g' };
const request = { server: 'acme@cloud', name: 'game', created: undefined };

function seedLists(): void {
  queryClient.setQueryData(queryKeys.repositories('acme@cloud'), []);
  queryClient.setQueryData(queryKeys.workspaces, []);
}

const invalidated = (queryKey: readonly unknown[]): boolean | undefined => queryClient.getQueryState(queryKey)?.isInvalidated;

describe('createNewRepository', () => {
  it('creates the repository, then its workspace, with no update, and refreshes both lists', async () => {
    fakeApi.answer('repositories.create', () => 'game@acme@cloud');
    fakeApi.answer('workspaces.create', () => created);
    seedLists();

    const outcome = await createNewRepository({ ...request, workspace });

    expect(outcome).toEqual({ kind: 'created', repositorySpec: 'game@acme@cloud', workspace: created });
    expect(fakeApi.methods()).toEqual(['repositories.create', 'workspaces.create']);
    expect(fakeApi.argsOf('repositories.create')).toEqual([['acme@cloud', 'game']]);
    expect(fakeApi.argsOf('workspaces.create')).toEqual([[{ ...workspace, repository: 'game@acme@cloud' }]]);
    expect(invalidated(queryKeys.repositories('acme@cloud'))).toBe(true);
    expect(invalidated(queryKeys.workspaces)).toBe(true);
  });

  it('creates only the repository when no workspace is asked for, and leaves the workspace list alone', async () => {
    fakeApi.answer('repositories.create', () => 'game@acme@cloud');
    seedLists();

    const outcome = await createNewRepository(request);

    expect(outcome).toEqual({ kind: 'created', repositorySpec: 'game@acme@cloud', workspace: undefined });
    expect(fakeApi.methods()).toEqual(['repositories.create']);
    expect(invalidated(queryKeys.repositories('acme@cloud'))).toBe(true);
    expect(invalidated(queryKeys.workspaces)).toBe(false);
  });

  it('says the repository failed, makes no workspace and refreshes nothing', async () => {
    fakeApi.answer('repositories.create', () => {
      throw commandFailure('The repository game already exists');
    });
    seedLists();

    const outcome = await createNewRepository({ ...request, workspace });

    expect(outcome).toMatchObject({ kind: 'failed', title: "Couldn't create the repository" });
    expect(outcome).not.toHaveProperty('createdRepository');
    expect(fakeApi.methods()).toEqual(['repositories.create']);
    expect(invalidated(queryKeys.repositories('acme@cloud'))).toBe(false);
  });

  it('names the repository made when its workspace failed, so trying again makes only the workspace', async () => {
    fakeApi.answer('repositories.create', () => 'game@acme@cloud');
    fakeApi.answer('workspaces.create', () => {
      throw commandFailure('The path is already in use');
    });
    seedLists();

    const outcome = await createNewRepository({ ...request, workspace });

    expect(outcome).toMatchObject({ kind: 'failed', title: 'Created game, but not its workspace', createdRepository: 'game@acme@cloud' });
    expect(invalidated(queryKeys.repositories('acme@cloud'))).toBe(true);

    fakeApi.answer('workspaces.create', () => created);
    const retried = await createNewRepository({ ...request, created: 'game@acme@cloud', workspace });

    expect(retried).toEqual({ kind: 'created', repositorySpec: 'game@acme@cloud', workspace: created });
    expect(fakeApi.methods()).toEqual(['repositories.create', 'workspaces.create', 'workspaces.create']);
  });
});
