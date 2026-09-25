import type { IncomingChanges, UpdateResolutions } from '@shared/domain/incoming';
import { spec } from '@shared/domain/specs';
import { ApiError, api } from '../../api/client';
import { navigation } from '../../app/navigation/navigationStore';
import { runOperation } from '../../app/operations/runOperation';
import { useToastStore } from '../../ui/toast/toastStore';
import { updatedMessage } from './updatedMessage';
import { updateStoppedByConflicts } from './updateFailure';

/**
 * Updates to the incoming changesets (known not to collide with local changes), then says what came in and offers
 * to see it. Resolves to whether it updated.
 */
export async function updateToIncoming(workspacePath: string, incoming: IncomingChanges): Promise<boolean> {
  const updated = await runOperation({
    title: 'Updating workspace',
    workspacePath,
    kind: 'update',
    run: async (operationId) => {
      await api.workspaces.update(workspacePath, operationId);
      return true;
    },
    successMessage: () => updatedMessage(incoming),
    successAction: () => ({ label: 'View', run: () => viewIncoming(incoming) }),
    onFailure: explainUpdateConflicts,
  });
  return updated === true;
}

/** An update that stopped at local changes colliding with incoming ones leads to Incoming rather than to an error. */
export function explainUpdateConflicts(error: unknown): boolean {
  if (!(error instanceof ApiError) || !updateStoppedByConflicts(error.command)) return false;
  useToastStore.getState().show({
    kind: 'error',
    title: "Couldn't update: your changes collide with incoming ones",
    detail: 'Some files you changed were also changed, moved or deleted on the branch.',
    action: { label: 'Open Incoming', run: () => navigation.goToView('incoming') },
  });
  return true;
}

function viewIncoming({ loadedChangeset, headChangeset, changesets }: IncomingChanges): void {
  const target =
    changesets.length === 1
      ? ({ kind: 'changeset', changesetId: headChangeset } as const)
      : ({ kind: 'range', fromSpec: spec.changeset(loadedChangeset), toSpec: spec.changeset(headChangeset) } as const);
  const title = changesets.length === 1 ? `Changeset ${headChangeset}` : `Changesets ${loadedChangeset + 1} to ${headChangeset}`;
  navigation.openPage({ kind: 'diff', title, target });
}

/** Updates the workspace, writing the user's merge of every file that changed both locally and on the branch. */
export function updateResolvingConflicts(workspacePath: string, resolutions: UpdateResolutions): Promise<unknown> {
  return runOperation({
    title: 'Updating workspace',
    workspacePath,
    kind: 'update',
    run: (operationId) => api.merge.updateResolvingConflicts(workspacePath, resolutions, operationId),
    successMessage: (result) =>
      result.backupDirectory ? `Workspace updated. Your previous versions were saved in ${result.backupDirectory}` : 'Workspace is up to date',
  });
}
