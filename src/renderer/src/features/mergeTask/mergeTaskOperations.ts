import type { Branch } from '@shared/domain/branch';
import type { CodeReviewSummary } from '@shared/domain/codeReview';
import { workspacePlace, type Place } from '@shared/domain/place';
import type { MergeOperation } from '@shared/domain/merge';
import { spec } from '@shared/domain/specs';
import { api } from '../../api/client';
import { navigation } from '../../app/navigation/navigationStore';
import { runAction, runVoidAction } from '../../app/operations/runOperation';
import { invalidatePlace, queryClient } from '../../app/queryClient';
import { toast } from '../../ui/toast/toastStore';
import { branchReviewsQuery } from '../codeReviews/changeRequests/useChangeRequests';
import { isAffectedByBranchList, isAffectedByCodeReviews } from '../../app/refresh/refreshScopes';
import { useFinishedTasksStore } from './finishedTask';
import { mergeRequestMergeOf, requestsToRecord, taskMergeOf, type MergeRequestToMerge, type TaskBranch, type TaskEnding, type TaskMerge } from './taskMerge';

/** Finishes a task: the merge page for merging it into its parent on the server. */
export function openTaskMerge(branch: TaskBranch & Pick<Branch, 'parent'>): void {
  openTaskMergePage(taskMergeOf(branch), branch.parent);
}

/** Merges a merge request: the merge page for merging its branch, `source`, into its destination on the server. */
export function openMergeRequestMerge(review: MergeRequestToMerge, source: string): void {
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
  { taskBranch, reviewsOfBranch, openedFrom, review, hideBranch }: TaskEnding,
  merged: { destination: string; changesetId: number | undefined },
): Promise<void> {
  const place = workspacePlace(workspacePath);
  const { destination, changesetId } = merged;
  if (changesetId !== undefined) {
    const reviews = reviewsOfBranch ?? (await readBranchReviews(place, taskBranch));
    // `cm mergerequest edit` takes one id: one command each, one request in practice.
    for (const reviewId of requestsToRecord(reviews, destination, openedFrom)) await recordMerged(place, reviewId, changesetId);
  }
  if (review) await runAction(place, "Couldn't mark your review as reviewed", () => api.codeReviews.setOwnStatus(place, review.id, 'Reviewed'), REFRESHED_AT_THE_END);
  if (hideBranch) await hideTaskBranch(workspacePath, taskBranch);
  if (changesetId !== undefined) {
    useFinishedTasksStore.getState().remember(workspacePath, { branch: taskBranch, destination, changesetId, hidden: hideBranch });
  }
  // Once, after every write on them: the merge's own refresh leaves the reviews out (`mergeRefreshScope`), as read
  // before the request is recorded they'd show it Open.
  void invalidatePlace(place, isAffectedByCodeReviews);
}

/** The reviews' writes while finishing refresh nothing of their own: `finishMergedTask` reads them once at the end. */
const REFRESHED_AT_THE_END = (): boolean => false;

/** Hides a finished task's branch; true once hidden. Only the lists of branches change. */
export function hideTaskBranch(workspacePath: string, taskBranch: string): Promise<boolean> {
  return runVoidAction(workspacePlace(workspacePath), "Couldn't hide the branch", () => api.branches.setHidden(workspacePlace(workspacePath), [taskBranch], true), isAffectedByBranchList);
}

/**
 * Records a merge request Merged in the changeset the app's merge made: a server with merge requests switched off
 * never does, and one with them on already did, which the write leaves as it is (docs/features/merge-requests.md
 * "Merging"). Should the write fail (a server may refuse it to someone else than its owner once it marked it itself),
 * the request is read once, and only an unmerged one is told about.
 */
async function recordMerged(place: Place, reviewId: number, changesetId: number): Promise<void> {
  try {
    await api.codeReviews.recordMerged(place, reviewId, changesetId);
  } catch (error) {
    if (!(await isMergedAlready(place, reviewId))) toast.error("Merged, but couldn't mark the merge request as merged", error);
  }
}

/** One `cm find review` of the request, after a failed record: whether the server has it Merged already. */
async function isMergedAlready(place: Place, reviewId: number): Promise<boolean> {
  try {
    const [request] = await api.codeReviews.listSummaries(place, { id: reviewId });
    return request?.mergeRequest?.state === 'Merged';
  } catch {
    return false;
  }
}

/**
 * The branch's reviews when the merge page hadn't read them by the time it merged: one `cm find review` of the branch,
 * under the key Changes reads it by. None should it fail: the request the page was opened from is recorded then.
 */
async function readBranchReviews(place: Place, branch: string): Promise<readonly CodeReviewSummary[] | undefined> {
  try {
    return await queryClient.fetchQuery(branchReviewsQuery(place, branch));
  } catch {
    return undefined;
  }
}
