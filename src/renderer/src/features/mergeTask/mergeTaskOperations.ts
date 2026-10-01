import type { CodeReviewSummary } from '@shared/domain/codeReview';
import type { MergeRequest, MergeResult } from '@shared/domain/merge';
import { spec } from '@shared/domain/specs';
import { api } from '../../api/client';
import { runAction, runOperation, runVoidAction } from '../../app/operations/runOperation';
import { isAffectedByBranchList, isAffectedByCodeReviews, isAffectedByNewChangesets } from '../../app/refresh/refreshScopes';
import { toast } from '../../ui/toast/toastStore';
import { showInBranchExplorer } from '../branchExplorer/branchExplorerStore';
import { switchToBranch } from '../branches/branchOperations';
import { openMerge } from '../merge/mergeOperations';
import { useFinishedTasksStore } from './finishedTask';

/** What else finishing a task does once it's merged. */
export interface TaskEnding {
  /** The task branch, e.g. `/main/t1`. */
  taskBranch: string;
  /** Marked as reviewed once merged. */
  review?: CodeReviewSummary;
  hideBranch: boolean;
}

interface FinishTaskOptions extends TaskEnding {
  comment: string;
}

/**
 * Merges the task on the server; the preview had no conflicts, so there is nothing to decide. Resolves to the result
 * (with `destinationMoved` when a second merge is needed), or undefined when it failed. Once merged, Changes shows where
 * it landed and what to do next (`FinishedTaskCard`).
 */
export async function mergeTaskOnServer(workspacePath: string, request: MergeRequest, options: FinishTaskOptions): Promise<MergeResult | undefined> {
  const destination = request.destinationBranch!;
  const result = await runOperation({
    title: `Merging ${options.taskBranch} into ${destination}`,
    workspacePath,
    run: (operationId) => api.merge.run(workspacePath, request, { directoryConflicts: [], files: {}, comment: options.comment }, operationId),
    // A changeset on the destination, as someone else's checkin would bring: the workspace is not touched.
    affects: isAffectedByNewChangesets,
  });
  if (!result || result.destinationMoved) return result;

  const changesetId = result.changesetId;
  await finishMergedTask(workspacePath, options, { destination, changesetId });
  toast.success(
    `Merged ${options.taskBranch} into ${destination}${changesetId === undefined ? '' : ` (cs:${changesetId})`}`,
    undefined,
    changesetId === undefined ? undefined : { label: 'Show in Branch Explorer', run: () => showInBranchExplorer({ kind: 'changeset', id: changesetId }) },
  );
  return result;
}

/**
 * What finishing a task does once it's merged into its destination: marks its review as reviewed and hides its branch
 * when asked to, and remembers where it landed, for Changes to show what to do next (`FinishedTaskCard`).
 */
export async function finishMergedTask(
  workspacePath: string,
  { taskBranch, review, hideBranch }: TaskEnding,
  merged: { destination: string; changesetId: number | undefined },
): Promise<void> {
  if (review) {
    await runAction(
      workspacePath,
      "Couldn't mark the code review as reviewed",
      () => api.codeReviews.update(workspacePath, review.id, { status: 'Reviewed' }),
      isAffectedByCodeReviews,
    );
  }
  if (hideBranch) await hideTaskBranch(workspacePath, taskBranch);
  const { destination, changesetId } = merged;
  if (changesetId !== undefined) {
    useFinishedTasksStore.getState().remember(workspacePath, { branch: taskBranch, destination, changesetId, hidden: hideBranch });
  }
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
