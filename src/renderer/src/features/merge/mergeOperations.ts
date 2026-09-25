import { followUpMerge, type MergeRequest, type MergeResolutions, type MergeResult } from '@shared/domain/merge';
import { api } from '../../api/client';
import { navigation } from '../../app/navigation/navigationStore';
import { runOperation } from '../../app/operations/runOperation';
import { isAffectedByCheckinOrUpdate } from '../../app/refresh/refreshScopes';
import { toast } from '../../ui/toast/toastStore';

/**
 * Runs the merge. Resolves with its result for the page to tell what happened, or null when there's nothing more to
 * show there: it failed, or a server merge's destination moved and the merge that finishes it opens instead.
 */
export async function completeMerge(workspacePath: string, request: MergeRequest, resolutions: MergeResolutions): Promise<MergeResult | null> {
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
        : 'Merge applied to your workspace',
  });
  if (!result) return null;

  if (request.destinationBranch && result.destinationMoved) {
    navigation.goBack();
    toast.info(`${request.destinationBranch} moved while merging`, destinationMovedExplanation(result.changesetId, request.destinationBranch));
    openMerge(followUpMerge(result, request.destinationBranch));
    return null;
  }
  return result;
}

export function openMerge(request: MergeRequest): void {
  navigation.openPage({ kind: 'merge', request });
}

/** Why a server-side merge needs a second one when someone checked in on its destination at the same time. */
export function destinationMovedExplanation(changesetId: number | undefined, destinationBranch: string): string {
  return `Someone checked in on ${destinationBranch} at the same time, so the merge (changeset ${changesetId}) sits beside the new head. Merge it into ${destinationBranch} to finish.`;
}
