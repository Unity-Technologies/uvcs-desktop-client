import { followUpMerge, type MergeRequest, type MergeResolutions, type MergeResult } from '@shared/domain/merge';
import { api } from '../../api/client';
import { navigation } from '../../app/navigation/navigationStore';
import { runOperation } from '../../app/operations/runOperation';
import { isAffectedByCheckinOrUpdate, isAffectedByNewChangesets, isAffectedByShelveApplied } from '../../app/refresh/refreshScopes';
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
    affects: mergeRefreshScope(request),
    success: (merged) => {
      if (!request.destinationBranch) return { title: 'Merge applied to your workspace' };
      return merged.destinationMoved ? null : { title: `Created changeset ${merged.changesetId} on ${request.destinationBranch}` };
    },
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

/** What a merge can change: the workspace and what a checkin changes, or only what a new changeset on the server does. */
function mergeRefreshScope(request: MergeRequest): (queryKey: readonly unknown[]) => boolean {
  // A merge into a branch on the server leaves the workspace untouched, as someone else's checkin would.
  if (request.destinationBranch) return isAffectedByNewChangesets;
  // Merging a shelve applies it, and may finish the left changes that offered it.
  return request.sourceSpec.startsWith('sh:') ? isAffectedByShelveApplied : isAffectedByCheckinOrUpdate;
}

export function openMerge(request: MergeRequest): void {
  navigation.openPage({ kind: 'merge', request });
}

/** Why a server-side merge needs a second one when someone checked in on its destination at the same time. */
export function destinationMovedExplanation(changesetId: number | undefined, destinationBranch: string): string {
  return `Someone checked in on ${destinationBranch} at the same time, so the merge (changeset ${changesetId}) sits beside the new head. Merge it into ${destinationBranch} to finish.`;
}
