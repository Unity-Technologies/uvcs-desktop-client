import type { Branch } from '@shared/domain/branch';
import { workspacePlace } from '@shared/domain/place';
import type { MergeOperation } from '@shared/domain/merge';
import { spec } from '@shared/domain/specs';
import { api } from '../../api/client';
import { navigation } from '../../app/navigation/navigationStore';
import { runAction, runVoidAction } from '../../app/operations/runOperation';
import { isAffectedByBranchList, isAffectedByCodeReviews } from '../../app/refresh/refreshScopes';
import { useFinishedTasksStore } from './finishedTask';
import { mergeRequestMergeOf, taskMergeOf, type MergeRequestReview, type TaskBranch, type TaskEnding, type TaskMerge } from './taskMerge';

/** Finishes a task: the merge page for merging it into its parent on the server. */
export function openTaskMerge(branch: TaskBranch & Pick<Branch, 'parent'>): void {
  openTaskMergePage(taskMergeOf(branch), branch.parent);
}

/** Merges a merge request: the merge page for merging its branch, `source`, into its destination on the server. */
export function openMergeRequestMerge(review: MergeRequestReview, source: string): void {
  openTaskMergePage(mergeRequestMergeOf(review, source), review.mergeRequest.destination);
}

function openTaskMergePage(task: TaskMerge, destination: string): void {
  const request: MergeOperation = { kind: 'merge', sourceSpec: spec.branch(task.branch.name), destinationBranch: destination };
  navigation.openPage({ kind: 'merge', request, task });
}

/**
 * What finishing a task does once it's merged into its destination: records its merge requests Merged, marks the user's
 * review as reviewed and hides its branch when asked to, and remembers where it landed, for Changes to show what to do
 * next (`FinishedTaskCard`). A step that fails says so and undoes nothing: the merge is in.
 */
export async function finishMergedTask(
  workspacePath: string,
  { taskBranch, mergeRequests, review, hideBranch }: TaskEnding,
  merged: { destination: string; changesetId: number | undefined },
): Promise<void> {
  const { destination, changesetId } = merged;
  if (changesetId !== undefined) {
    for (const reviewId of mergeRequests) await recordMerged(workspacePath, reviewId, changesetId);
  }
  if (review) {
    await runAction(
      workspacePlace(workspacePath),
      "Couldn't mark your review as reviewed",
      () => api.codeReviews.setOwnStatus(workspacePlace(workspacePath), review.id, 'Reviewed'),
      isAffectedByCodeReviews,
    );
  }
  if (hideBranch) await hideTaskBranch(workspacePath, taskBranch);
  if (changesetId !== undefined) {
    useFinishedTasksStore.getState().remember(workspacePath, { branch: taskBranch, destination, changesetId, hidden: hideBranch });
  }
}

/** Hides a finished task's branch; true once hidden. Only the lists of branches change. */
export function hideTaskBranch(workspacePath: string, taskBranch: string): Promise<boolean> {
  return runVoidAction(workspacePlace(workspacePath), "Couldn't hide the branch", () => api.branches.setHidden(workspacePlace(workspacePath), [taskBranch], true), isAffectedByBranchList);
}

/**
 * Records a merge request Merged in the changeset the app's merge made: a server with merge requests switched off
 * never does, and one with them on already did, which the write leaves as it is (docs/features/merge-requests.md "Merging").
 */
function recordMerged(workspacePath: string, reviewId: number, changesetId: number): Promise<boolean> {
  const place = workspacePlace(workspacePath);
  return runVoidAction(place, `Merged, but couldn't mark merge request ${reviewId} as merged`, () => api.codeReviews.recordMerged(place, reviewId, changesetId), isAffectedByCodeReviews);
}
