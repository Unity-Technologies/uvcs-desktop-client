import type { WorkspaceSummary } from '@shared/domain/workspace';

interface CreationSteps {
  /** The spec of the repository an earlier try already created: only its workspace is left to create. */
  created: string | undefined;
  /** Creates the repository: resolves to its spec. */
  createRepository: () => Promise<string>;
  /** Missing when no workspace was asked for. */
  createWorkspace?: (repositorySpec: string) => Promise<WorkspaceSummary>;
}

export type CreationOutcome =
  | { kind: 'done'; repositorySpec: string; workspace?: WorkspaceSummary }
  | { kind: 'repositoryFailed'; error: unknown }
  /** The repository exists now; trying again must only create the workspace. */
  | { kind: 'workspaceFailed'; repositorySpec: string; error: unknown };

/** Creates the repository (unless an earlier try did), then its workspace, telling which step failed. */
export async function createRepositoryWithWorkspace({ created, createRepository, createWorkspace }: CreationSteps): Promise<CreationOutcome> {
  let repositorySpec = created;
  if (!repositorySpec) {
    try {
      repositorySpec = await createRepository();
    } catch (error) {
      return { kind: 'repositoryFailed', error };
    }
  }
  if (!createWorkspace) return { kind: 'done', repositorySpec };
  try {
    return { kind: 'done', repositorySpec, workspace: await createWorkspace(repositorySpec) };
  } catch (error) {
    return { kind: 'workspaceFailed', repositorySpec, error };
  }
}
