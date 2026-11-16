import type { Branch } from '@shared/domain/branch';
import type { CodeReviewSummary, MergeRequestInfo } from '@shared/domain/codeReview';
import { canMarkReviewed } from './mergeTaskSummary';

/** A task branch as finishing it needs it: its name, and its comment, which starts the merge's. */
export type TaskBranch = Pick<Branch, 'name' | 'comment'>;

/** What finishing a task does besides merging it, as picked on the merge page. */
export interface TaskMergeChoices {
  markReviewed: boolean;
  hideBranch: boolean;
}

/** The merge request a task merge was opened from: the merge page names it, and its title starts the comment. */
export interface TaskMergeRequest {
  id: number;
  title: string;
}

/**
 * A task branch merged into a branch on the server (its parent, its merge request's destination, or another one
 * picked: the merge's own `destinationBranch`): the merge page also offers to mark its review as reviewed and to hide
 * it, and records its merge requests into that destination Merged. The merge that finishes it when its destination
 * moved carries the choices made on the first one.
 */
export interface TaskMerge {
  branch: TaskBranch;
  mergeRequest?: TaskMergeRequest;
  choices: TaskMergeChoices;
}

/** A task being finished on the merge page: the choices made, its review, when it has one, and who finishes it. */
export interface FinishingTask {
  task: TaskMerge;
  review: CodeReviewSummary | undefined;
  /** The user on the place's server, who marks the review as one of its reviewers. */
  user: string | undefined;
  /** The branch's reviews, for the merge requests the merge finishes (`requestsToRecord`); none until read. */
  reviewsOfBranch: readonly CodeReviewSummary[] | undefined;
}

/** What else finishing a task does once it's merged (`finishMergedTask`). */
export interface TaskEnding {
  /** The task branch, e.g. `/main/t1`. */
  taskBranch: string;
  /** The branch's reviews, whose merge requests into the destination are recorded Merged; none when not read yet. */
  reviewsOfBranch?: readonly CodeReviewSummary[];
  /** The merge request the merge was opened from. */
  openedFrom?: TaskMergeRequest;
  /** Marked as reviewed by the user once merged. */
  review?: CodeReviewSummary;
  hideBranch: boolean;
}

export const NO_TASK_CHOICES: TaskMergeChoices = { markReviewed: false, hideBranch: false };

/** The task merge of a branch as any list has it, keeping only what finishing it needs. */
export function taskMergeOf({ name, comment }: TaskBranch): TaskMerge {
  return { branch: { name, comment }, choices: NO_TASK_CHOICES };
}

/** A review that is a merge request, as merging it needs it. */
export type MergeRequestToMerge = Pick<CodeReviewSummary, 'id' | 'title'> & { mergeRequest: MergeRequestInfo };

/** The task merge a merge request asks for: its branch, `source`, merged into its destination. */
export function mergeRequestMergeOf(review: MergeRequestToMerge, source: string): TaskMerge {
  return {
    // Its title starts the merge's comment, not the branch's: no need to read the branch for it.
    branch: { name: source, comment: '' },
    mergeRequest: { id: review.id, title: review.title },
    choices: NO_TASK_CHOICES,
  };
}

/**
 * The merge requests a task's merge finishes: the branch's Open ones into that destination, as a server with merge
 * requests switched on marks them itself (usually one; every one when several). When the branch's reviews couldn't be
 * read, the one the merge was opened from.
 */
export function requestsToRecord(reviewsOfBranch: readonly CodeReviewSummary[] | undefined, destination: string, openedFrom?: TaskMergeRequest): number[] {
  if (!reviewsOfBranch) return openedFrom ? [openedFrom.id] : [];
  return reviewsOfBranch.filter(({ mergeRequest }) => mergeRequest?.state === 'Open' && mergeRequest.destination === destination).map(({ id }) => id);
}

/** What finishing the task does once merged: its review is marked only when picked and the user can mark it. */
export function taskEnding({ task, review, user, reviewsOfBranch }: FinishingTask): TaskEnding {
  return {
    taskBranch: task.branch.name,
    ...(reviewsOfBranch && { reviewsOfBranch }),
    ...(task.mergeRequest && { openedFrom: task.mergeRequest }),
    review: task.choices.markReviewed && canMarkReviewed(review, user) ? review : undefined,
    hideBranch: task.choices.hideBranch,
  };
}
