import type { CodeReviewSummary } from '@shared/domain/codeReview';
import type { MergeRequest, MergeResult } from '@shared/domain/merge';
import { spec } from '@shared/domain/specs';
import { api } from '../../api/client';
import { runAction, runOperation, runVoidAction } from '../../app/operations/runOperation';
import { isAffectedByBranchList, isAffectedByCodeReviews, isAffectedByNewChangesets } from '../../app/refresh/refreshScopes';
import { branchLabels } from '../../lib/branchLabels';
import { toast } from '../../ui/toast/toastStore';
import { showInBranchExplorer } from '../branchExplorer/branchExplorerStore';
import { switchToBranch } from '../branches/branchOperations';
import { openMerge } from '../merge/mergeOperations';
import { useFinishedTasksStore } from './finishedTask';

interface FinishTaskOptions {
  /** The task branch, e.g. `/main/t1`. */
  taskBranch: string;
  comment: string;
  /** Marked as reviewed once merged. */
  review?: CodeReviewSummary;
  hideBranch: boolean;
}

/**
 * Merges the task on the server; the preview had no conflicts, so there is nothing to decide. Resolves to the result
 * (with `destinationMoved` when a second merge is needed), or undefined when it failed. Once merged, Changes shows where
 * it landed and what to do next (`FinishedTaskCard`).
 */
export async function mergeTaskOnServer(workspacePath: string, request: MergeRequest, options: FinishTaskOptions): Promise<MergeResult | undefined> {
  const destination = request.destinationBranch!;
  const [taskName, destinationName] = branchLabels(options.taskBranch, destination);
  const result = await runOperation({
    title: `Merging ${taskName} into ${destinationName}`,
    workspacePath,
    run: (operationId) => api.merge.run(workspacePath, request, { directoryConflicts: [], files: {}, comment: options.comment }, operationId),
    // A changeset on the destination, as someone else's checkin would bring: the workspace is not touched.
    affects: isAffectedByNewChangesets,
  });
  if (!result || result.destinationMoved) return result;

  const { review } = options;
  if (review) {
    await runAction(
      workspacePath,
      "Couldn't mark the code review as reviewed",
      () => api.codeReviews.update(workspacePath, review.id, { status: 'Reviewed' }),
      isAffectedByCodeReviews,
    );
  }
  if (options.hideBranch) await hideTaskBranch(workspacePath, options.taskBranch);
  const changesetId = result.changesetId;
  if (changesetId !== undefined) {
    useFinishedTasksStore.getState().remember(workspacePath, { branch: options.taskBranch, destination, changesetId, hidden: options.hideBranch });
  }
  toast.success(
    `Merged ${taskName} into ${destinationName}${changesetId === undefined ? '' : ` (cs:${changesetId})`}`,
    undefined,
    changesetId === undefined ? undefined : { label: 'Show in Branch Explorer', run: () => showInBranchExplorer({ kind: 'changeset', id: changesetId }) },
  );
  return result;
}

/** Hides a finished task's branch; true once hidden. Only the lists of branches change. */
export function hideTaskBranch(workspacePath: string, taskBranch: string): Promise<boolean> {
  return runVoidAction(workspacePath, "Couldn't hide the branch", () => api.branches.setHidden(workspacePath, [taskBranch], true), isAffectedByBranchList);
}

/** Brings the destination into the task branch in the workspace, so the conflicts are resolved there first. */
export async function mergeDestinationIntoTask(workspacePath: string, currentBranch: string | undefined, taskBranch: string, destination: string): Promise<void> {
  if (currentBranch !== taskBranch && !(await switchToBranch(workspacePath, taskBranch))) return;
  openMerge({ kind: 'merge', sourceSpec: spec.branch(destination) });
}

/** Merges the task into the destination in the workspace, where the conflicts can be resolved; checking in finishes it. */
export async function resolveOnDestination(workspacePath: string, currentBranch: string | undefined, sourceSpec: string, destination: string): Promise<void> {
  if (currentBranch !== destination && !(await switchToBranch(workspacePath, destination))) return;
  openMerge({ kind: 'merge', sourceSpec });
}
