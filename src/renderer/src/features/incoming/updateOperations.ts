import type { UpdateResolutions } from '@shared/domain/incoming';
import { api } from '../../api/client';
import { runOperation } from '../../app/operations/runOperation';

/** Updates the workspace, writing the user's merge of every file that changed both locally and on the branch. */
export function updateResolvingConflicts(workspacePath: string, resolutions: UpdateResolutions): Promise<unknown> {
  return runOperation({
    title: 'Updating workspace',
    workspacePath,
    run: (operationId) => api.merge.updateResolvingConflicts(workspacePath, resolutions, operationId),
    successMessage: (result) =>
      result.backupDirectory ? `Workspace updated. Your previous versions were saved in ${result.backupDirectory}` : 'Workspace is up to date',
  });
}
