import type { IncomingChanges, UpdateResolutions } from '@shared/domain/incoming';
import { spec } from '@shared/domain/specs';
import { api } from '../../api/client';
import { navigation } from '../../app/navigation/navigationStore';
import { runOperation } from '../../app/operations/runOperation';
import { updatedMessage } from './updatedMessage';

/** Updates to the incoming changesets (known not to collide with local changes), then says what came in and offers to see it. */
export function updateToIncoming(workspacePath: string, incoming: IncomingChanges): Promise<unknown> {
  return runOperation({
    title: 'Updating workspace',
    workspacePath,
    kind: 'update',
    run: (operationId) => api.workspaces.update(workspacePath, operationId),
    successMessage: () => updatedMessage(incoming),
    successAction: () => ({ label: 'View', run: () => viewIncoming(incoming) }),
  });
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
