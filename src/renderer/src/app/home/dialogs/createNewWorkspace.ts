import { createNewRepository, type CreationFailure } from './createNewRepository';
import { createWorkspaceAndUpdate } from './createWorkspaceAndUpdate';
import type { WorkspaceRepository } from './newWorkspaceForm';

interface NewWorkspace {
  name: string;
  path: string;
  repository: WorkspaceRepository;
}

export type NewWorkspaceOutcome = { kind: 'opened' } | CreationFailure;

/**
 * What the New workspace dialog's Create does. In an existing repository: creates the workspace, opens it and
 * downloads its files (`createWorkspaceAndUpdate`). With a new repository: creates the repository (unless an earlier
 * try did) and the workspace, and opens it without an update (`createNewRepository`).
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

  const outcome = await createNewRepository({ server: repository.server, name: repository.name, created: repository.created, workspace: { name, path } });
  if (outcome.kind === 'failed') return outcome;
  // Always there: a workspace was asked for.
  open(outcome.workspace!.path);
  return { kind: 'opened' };
}
