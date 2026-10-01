import { followUpMerge, type MergeRequest, type MergeResolutions, type MergeResult } from '@shared/domain/merge';
import { api } from '../../api/client';
import { navigation } from '../../app/navigation/navigationStore';
import { runOperation, type OperationSuccess } from '../../app/operations/runOperation';
import { isAffectedByCheckinOrUpdate, isAffectedByNewChangesets, isAffectedByShelveApplied } from '../../app/refresh/refreshScopes';
import { toast } from '../../ui/toast/toastStore';
import { showInBranchExplorer } from '../branchExplorer/branchExplorerStore';
import { finishMergedTask } from '../mergeTask/mergeTaskOperations';
import { taskEnding, type FinishingTask, type TaskMerge } from '../mergeTask/taskMerge';
import { describeSpec } from './mergeDescription';

/**
 * Runs the merge. Resolves with its result for the page to tell what happened, or null when there's nothing more to
 * show there: it failed, or it merged into a branch on the server, which goes back to where the merge was opened from
 * with a toast naming the new changeset (or opens the merge that finishes it, when its destination moved meanwhile).
 * A task merged so is finished as picked on the page (`finishMergedTask`).
 */
export async function completeMerge(
  workspacePath: string,
  request: MergeRequest,
  resolutions: MergeResolutions,
  finishing?: FinishingTask,
): Promise<MergeResult | null> {
  const sourceName = finishing?.task.branch.name ?? describeSpec(request.sourceSpec);
  const result = await runOperation({
    title: 'Merging',
    workspacePath,
    run: (operationId) => api.merge.run(workspacePath, request, resolutions, operationId),
    affects: mergeRefreshScope(request),
    success: (merged) => mergeSuccess(request, sourceName, merged),
  });
  if (!result) return null;
  const destination = request.destinationBranch;
  if (!destination) return result;

  navigation.goBack();
  if (result.destinationMoved) {
    toast.info(`${destination} moved while merging`, destinationMovedExplanation(result.changesetId, destination));
    openMerge(followUpMerge(result, destination), finishing?.task);
  } else if (finishing) {
    await finishMergedTask(workspacePath, taskEnding(finishing), { destination, changesetId: result.changesetId });
  }
  return null;
}

/** What a merge can change: the workspace and what a checkin changes, or only what a new changeset on the server does. */
function mergeRefreshScope(request: MergeRequest): (queryKey: readonly unknown[]) => boolean {
  // A merge into a branch on the server leaves the workspace untouched, as someone else's checkin would.
  if (request.destinationBranch) return isAffectedByNewChangesets;
  // Merging a shelve applies it, and may finish the left changes that offered it.
  return request.sourceSpec.startsWith('sh:') ? isAffectedByShelveApplied : isAffectedByCheckinOrUpdate;
}

/**
 * How a merge's progress card ends: the workspace has the result to check in, or the server a new changeset, a click
 * away in the Branch Explorer. It goes away in silence while a server merge still needs the one that finishes it.
 */
function mergeSuccess(request: MergeRequest, sourceName: string, result: MergeResult): OperationSuccess | null {
  const destination = request.destinationBranch;
  if (!destination) return { title: 'Merge applied to your workspace' };
  if (result.destinationMoved) return null;
  const merged = `Merged ${sourceName} into ${destination}`;
  const { changesetId } = result;
  if (changesetId === undefined) return { title: merged };
  return {
    title: `${merged} (cs:${changesetId})`,
    action: { label: 'Show in Branch Explorer', run: () => showInBranchExplorer({ kind: 'changeset', id: changesetId }) },
  };
}

/** Opens the merge page; `task` when it finishes a task branch on the server. */
export function openMerge(request: MergeRequest, task?: TaskMerge): void {
  navigation.openPage({ kind: 'merge', request, ...(task && { task }) });
}

/** Why a server-side merge needs a second one when someone checked in on its destination at the same time. */
export function destinationMovedExplanation(changesetId: number | undefined, destinationBranch: string): string {
  return `Someone checked in on ${destinationBranch} at the same time, so the merge (changeset ${changesetId}) sits beside the new head. Merge it into ${destinationBranch} to finish.`;
}
