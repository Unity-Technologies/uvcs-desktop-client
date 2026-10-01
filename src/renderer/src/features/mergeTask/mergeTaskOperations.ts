import type { MergeRequest } from '@shared/domain/merge';
import { spec } from '@shared/domain/specs';
import { api } from '../../api/client';
import { navigation } from '../../app/navigation/navigationStore';
import { runAction, runVoidAction } from '../../app/operations/runOperation';
import { isAffectedByBranchList, isAffectedByCodeReviews } from '../../app/refresh/refreshScopes';
import { useFinishedTasksStore } from './finishedTask';
import { taskMergeOf, type TaskBranch, type TaskEnding } from './taskMerge';

/** Finishes a task: the merge page for merging it into its parent on the server. */
export function openTaskMerge(branch: TaskBranch): void {
  const request: MergeRequest = { kind: 'merge', sourceSpec: spec.branch(branch.name), destinationBranch: branch.parent };
  navigation.openPage({ kind: 'merge', request, task: taskMergeOf(branch) });
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
