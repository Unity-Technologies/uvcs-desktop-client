import type { WorkspaceSummary } from '@shared/domain/workspace';
import { api } from '../../../api/client';
import { queryKeys } from '../../../api/queryKeys';
import { queryClient } from '../../queryClient';
import { createRepositoryWithWorkspace } from './createRepositoryWithWorkspace';

interface NewRepository {
  server: string;
  /** As the user typed it, without the spaces around. */
  name: string;
  /** The spec of the repository an earlier try made before its workspace failed: only the workspace is left. */
  created: string | undefined;
  /** The workspace to create with it; none when not asked for. */
  workspace?: { name: string; path: string };
}

/** What a dialog tells the user when creating failed. `createdRepository`: made already, so trying again makes only the workspace. */
export interface CreationFailure {
  kind: 'failed';
  title: string;
  error: unknown;
  createdRepository?: string;
}

export type NewRepositoryOutcome = { kind: 'created'; repositorySpec: string; workspace?: WorkspaceSummary } | CreationFailure;

/**
 * Creates a repository (unless an earlier try did) and the workspace asked for with it, as the New repository and New
 * workspace dialogs do; refreshes the server's repositories, and the workspace list when a workspace was made. The
 * workspace isn't updated: a new repository has no files yet.
 */
export async function createNewRepository({ server, name, created, workspace }: NewRepository): Promise<NewRepositoryOutcome> {
  const outcome = await createRepositoryWithWorkspace({
    created,
    createRepository: () => api.repositories.create(server, name),
    createWorkspace: workspace && ((repositorySpec) => api.workspaces.create({ ...workspace, repository: repositorySpec })),
  });
  if (outcome.kind === 'repositoryFailed') return { kind: 'failed', title: "Couldn't create the repository", error: outcome.error };
  void queryClient.invalidateQueries({ queryKey: queryKeys.repositories(server) });
  if (outcome.kind === 'workspaceFailed') {
    return { kind: 'failed', title: `Created ${name}, but not its workspace`, error: outcome.error, createdRepository: outcome.repositorySpec };
  }
  if (outcome.workspace) void queryClient.invalidateQueries({ queryKey: queryKeys.workspaces });
  return { kind: 'created', repositorySpec: outcome.repositorySpec, workspace: outcome.workspace };
}
