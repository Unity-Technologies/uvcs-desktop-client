import { describe, expect, it, vi } from 'vitest';
import type { WorkspaceSummary } from '@shared/domain/workspace';
import { createRepositoryWithWorkspace } from './createRepositoryWithWorkspace';

const repositorySpec = 'game@local';
const workspace: WorkspaceSummary = { name: 'game', path: '/Users/me/game', guid: 'g' };

describe('createRepositoryWithWorkspace', () => {
  it('creates the repository, then its workspace', async () => {
    const createWorkspace = vi.fn().mockResolvedValue(workspace);
    const outcome = await createRepositoryWithWorkspace({ created: undefined, createRepository: async () => repositorySpec, createWorkspace });
    expect(outcome).toEqual({ kind: 'done', repositorySpec, workspace });
    expect(createWorkspace).toHaveBeenCalledWith(repositorySpec);
  });

  it('creates only the repository when no workspace is asked for', async () => {
    const outcome = await createRepositoryWithWorkspace({ created: undefined, createRepository: async () => repositorySpec });
    expect(outcome).toEqual({ kind: 'done', repositorySpec });
  });

  it('tells a failed repository from a failed workspace', async () => {
    const error = new Error('already exists');
    const createWorkspace = vi.fn();
    const failedRepository = await createRepositoryWithWorkspace({
      created: undefined,
      createRepository: () => Promise.reject(error),
      createWorkspace,
    });
    expect(failedRepository).toEqual({ kind: 'repositoryFailed', error });
    expect(createWorkspace).not.toHaveBeenCalled();

    const failedWorkspace = await createRepositoryWithWorkspace({
      created: undefined,
      createRepository: async () => repositorySpec,
      createWorkspace: () => Promise.reject(error),
    });
    expect(failedWorkspace).toEqual({ kind: 'workspaceFailed', repositorySpec, error });
  });

  it('creates only the workspace once an earlier try created the repository', async () => {
    const createRepository = vi.fn();
    const outcome = await createRepositoryWithWorkspace({ created: repositorySpec, createRepository, createWorkspace: async () => workspace });
    expect(outcome).toEqual({ kind: 'done', repositorySpec, workspace });
    expect(createRepository).not.toHaveBeenCalled();
  });
});
