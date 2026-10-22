import { api } from '../../../api/client';
import { queryKeys } from '../../../api/queryKeys';
import { queryClient } from '../../queryClient';
import { createRepositoryWithWorkspace } from './createRepositoryWithWorkspace';
import { createWorkspaceAndUpdate } from './createWorkspaceAndUpdate';
import type { WorkspaceRepository } from './newWorkspaceForm';

interface NewWorkspace {
  name: string;
  path: string;
  repository: WorkspaceRepository;
}

export type NewWorkspaceOutcome =
  | { kind: 'opened' }
  /** `createdRepository`: the repository was made before the workspace failed, so trying again makes only the workspace. */
  | { kind: 'failed'; title: string; error: unknown; createdRepository?: string };

/**
 * What the New workspace dialog's Create does. In an existing repository: creates the workspace, opens it and
 * downloads its files (`createWorkspaceAndUpdate`). With a new repository: creates the repository (unless an earlier
 * try did), then the workspace, and opens it without an update, as a new repository has no files yet.
 */
export async function createNewWorkspace({ name, path, repository }: NewWorkspace, open: (workspacePath: string) => void): Promise<NewWorkspaceOutcome> {
  if (repository.kind === 'existing') {
    try {
      await createWorkspaceAndUpdate({ name, path, repository: repository.spec }, open);
      return { kind: 'opened' };
    } catch (error) {
      return { kind: 'failed', title: "Couldn't create the workspace", error };
    }
  }

  const outcome = await createRepositoryWithWorkspace({
    created: repository.created,
    createRepository: () => api.repositories.create(repository.server, repository.name),
    createWorkspace: (repositorySpec) => api.workspaces.create({ name, path, repository: repositorySpec }),
  });
  if (outcome.kind === 'repositoryFailed') return { kind: 'failed', title: "Couldn't create the repository", error: outcome.error };
  void queryClient.invalidateQueries({ queryKey: queryKeys.repositories(repository.server) });
  if (outcome.kind === 'workspaceFailed') {
    return { kind: 'failed', title: `Created ${repository.name}, but not its workspace`, error: outcome.error, createdRepository: outcome.repositorySpec };
  }
  void queryClient.invalidateQueries({ queryKey: queryKeys.workspaces });
  // Always there: a workspace was asked for.
  open(outcome.workspace!.path);
  return { kind: 'opened' };
}
