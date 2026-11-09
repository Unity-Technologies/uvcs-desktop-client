import type { Branch } from '@shared/domain/branch';
import type { CodeReviewSummary } from '@shared/domain/codeReview';
import { canMarkReviewed } from './mergeTaskSummary';

/** A task branch as finishing it needs it: its review is found by its id, and its comment starts the merge's. */
export type TaskBranch = Pick<Branch, 'id' | 'name' | 'parent' | 'comment'>;

/** What finishing a task does besides merging it, as picked on the merge page. */
export interface TaskMergeChoices {
  markReviewed: boolean;
  hideBranch: boolean;
}

/**
 * A task branch merged into a branch on the server (its parent, or another one picked): the merge page also offers to
 * mark its review as reviewed and to hide it. The merge that finishes it when its destination moved carries the
 * choices made on the first one.
 */
export interface TaskMerge {
  branch: TaskBranch;
  choices: TaskMergeChoices;
}

/** A task being finished on the merge page: the choices made, its review, when it has one, and who finishes it. */
export interface FinishingTask {
  task: TaskMerge;
  review: CodeReviewSummary | undefined;
  /** The user on the place's server, who marks the review as one of its reviewers. */
  user: string | undefined;
}

/** What else finishing a task does once it's merged (`finishMergedTask`). */
export interface TaskEnding {
  /** The task branch, e.g. `/main/t1`. */
  taskBranch: string;
  /** Marked as reviewed by the user once merged. */
  review?: CodeReviewSummary;
  hideBranch: boolean;
}

export const NO_TASK_CHOICES: TaskMergeChoices = { markReviewed: false, hideBranch: false };

/** The task merge of a branch as any list has it, keeping only what finishing it needs. */
export function taskMergeOf({ id, name, parent, comment }: TaskBranch): TaskMerge {
  return { branch: { id, name, parent, comment }, choices: NO_TASK_CHOICES };
}

/** What finishing the task does once merged: its review is marked only when picked and the user can mark it. */
export function taskEnding({ task, review, user }: FinishingTask): TaskEnding {
  return {
    taskBranch: task.branch.name,
    review: task.choices.markReviewed && canMarkReviewed(review, user) ? review : undefined,
    hideBranch: task.choices.hideBranch,
  };
}
