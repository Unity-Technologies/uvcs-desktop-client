import { followUpMerge, type MergeRequest, type MergeResolutions } from '@shared/domain/merge';
import { api } from '../../api/client';
import { navigation } from '../../app/navigation/navigationStore';
import { runOperation } from '../../app/operations/runOperation';
import { isAffectedByCheckinOrUpdate } from '../../app/refresh/refreshScopes';
import { toast } from '../../ui/toast/toastStore';

/** Runs the merge; workspace merges then show the pending changes to check in. */
export async function completeMerge(workspacePath: string, request: MergeRequest, resolutions: MergeResolutions): Promise<void> {
  const result = await runOperation({
    title: 'Merging',
    workspacePath,
    run: (operationId) => api.merge.run(workspacePath, request, resolutions, operationId),
    // Merging a shelve that was left behind when switching finishes those left changes.
    affects: request.sourceSpec.startsWith('sh:') ? undefined : isAffectedByCheckinOrUpdate,
    successMessage: (merged) =>
      request.destinationBranch
        ? merged.destinationMoved
          ? null
          : `Created changeset ${merged.changesetId} on ${request.destinationBranch}`
        : 'Merged. Review the result and check it in.',
  });
  if (!result) return;

  if (!request.destinationBranch) {
    navigation.goToView('changes');
    return;
  }
  navigation.goBack();
  if (result.destinationMoved) {
    toast.info(`${request.destinationBranch} moved while merging`, destinationMovedExplanation(result.changesetId, request.destinationBranch));
    openMerge(followUpMerge(result, request.destinationBranch));
  }
}

export function openMerge(request: MergeRequest): void {
  navigation.openPage({ kind: 'merge', request });
}

/** Why a server-side merge needs a second one when someone checked in on its destination at the same time. */
export function destinationMovedExplanation(changesetId: number | undefined, destinationBranch: string): string {
  return `Someone checked in on ${destinationBranch} at the same time, so the merge (changeset ${changesetId}) sits beside the new head. Merge it into ${destinationBranch} to finish.`;
}
