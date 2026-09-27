import type { RepositorySummary } from '@shared/domain/repository';
import type { WorkspaceSummary } from '@shared/domain/workspace';

interface CreationSteps {
  /** The repository an earlier try already created: only its workspace is left to create. */
  created: RepositorySummary | undefined;
  createRepository: () => Promise<RepositorySummary>;
  /** Missing when no workspace was asked for. */
  createWorkspace?: (repository: RepositorySummary) => Promise<WorkspaceSummary>;
}

export type CreationOutcome =
  | { kind: 'done'; repository: RepositorySummary; workspace?: WorkspaceSummary }
  | { kind: 'repositoryFailed'; error: unknown }
  /** The repository exists now; trying again must only create the workspace. */
  | { kind: 'workspaceFailed'; repository: RepositorySummary; error: unknown };

/** Creates the repository (unless an earlier try did), then its workspace, telling which step failed. */
export async function createRepositoryWithWorkspace({ created, createRepository, createWorkspace }: CreationSteps): Promise<CreationOutcome> {
  let repository = created;
  if (!repository) {
    try {
      repository = await createRepository();
    } catch (error) {
      return { kind: 'repositoryFailed', error };
    }
  }
  if (!createWorkspace) return { kind: 'done', repository };
  try {
    return { kind: 'done', repository, workspace: await createWorkspace(repository) };
  } catch (error) {
    return { kind: 'workspaceFailed', repository, error };
  }
}
