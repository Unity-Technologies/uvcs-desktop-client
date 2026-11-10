import type { WorkspaceKind } from '@shared/domain/workspace';
import { createNewRepository, type CreationFailure } from './createNewRepository';
import { createWorkspaceAndUpdate } from './createWorkspaceAndUpdate';
import type { WorkspaceRepository } from './newWorkspaceForm';

interface NewWorkspace {
  name: string;
  path: string;
  repository: WorkspaceRepository;
  /** How it holds its files (`CreateWorkspaceRequest.kind`); standard when not given. */
  kind?: WorkspaceKind;
}

export type NewWorkspaceOutcome = { kind: 'opened' } | CreationFailure;

/**
 * What the New workspace dialog's Create does. In an existing repository: creates the workspace, opens it and
 * downloads its files, or asks a partial one what to download (`createWorkspaceAndUpdate`). With a new repository:
 * creates the repository (unless an earlier
 * try did) and the workspace, and opens it without an update or a choice, since it holds nothing yet
 * (`createNewRepository`). Either can be dynamic or partial.
 */
export async function createNewWorkspace({ name, path, repository, kind }: NewWorkspace, open: (workspacePath: string) => void): Promise<NewWorkspaceOutcome> {
  if (repository.kind === 'existing') {
    try {
      await createWorkspaceAndUpdate({ name, path, repository: repository.spec, kind }, open);
      return { kind: 'opened' };
    } catch (error) {
      return { kind: 'failed', title: "Couldn't create the workspace", error };
    }
  }

  const outcome = await createNewRepository({ server: repository.server, name: repository.name, created: repository.created, workspace: { name, path, kind } });
  if (outcome.kind === 'failed') return outcome;
  // Always there: a workspace was asked for.
  open(outcome.workspace!.path);
  return { kind: 'opened' };
}
