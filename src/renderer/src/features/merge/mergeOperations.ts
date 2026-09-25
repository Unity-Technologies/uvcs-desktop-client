import type { MergeRequest, MergeResolutions } from '@shared/domain/merge';
import { api } from '../../api/client';
import { navigation } from '../../app/navigation/navigationStore';
import { runOperation } from '../../app/operations/runOperation';

/** Runs the merge; workspace merges then show the pending changes to check in. */
export async function completeMerge(workspacePath: string, request: MergeRequest, resolutions: MergeResolutions): Promise<void> {
  const result = await runOperation({
    title: 'Merging',
    workspacePath,
    run: (operationId) => api.merge.run(workspacePath, request, resolutions, operationId),
    successMessage: (merged) =>
      request.destinationBranch
        ? `Created changeset ${merged.changesetId} on ${request.destinationBranch}`
        : 'Merged. Review the result and check it in.',
  });
  if (!result) return;

  if (request.destinationBranch) navigation.goBack();
  else navigation.goToView('changes');
}

export function openMerge(request: MergeRequest): void {
  navigation.openPage({ kind: 'merge', request });
}
