import type { Branch } from '@shared/domain/branch';
import { isReviewer, ownStatus } from '../codeReviews/reviewers';
import type { CodeReviewSummary } from '@shared/domain/codeReview';
import { firstLine } from '../../lib/text';

/** "Merge /main/t1: Add the login screen", or just "Merge /main/t1" when the branch has no comment. */
export function defaultMergeComment(branch: Pick<Branch, 'name' | 'comment'>): string {
  const summary = firstLine(branch.comment);
  return summary ? `Merge ${branch.name}: ${summary}` : `Merge ${branch.name}`;
}

/**
 * Whether the merge can also mark the branch's review as reviewed by `user`: there is one, they are one of its
 * reviewers (only reviewers give a status), and they haven't marked it yet.
 */
export function canMarkReviewed(review: CodeReviewSummary | undefined, user: string | undefined): review is CodeReviewSummary {
  return review !== undefined && isReviewer(review, user) && ownStatus(review, user) !== 'Reviewed';
}

/** Whether a branch looks like a task branch that can be finished by merging it to its parent. */
export function isTaskBranch(branch: Pick<Branch, 'parent'> | undefined): branch is Branch {
  return Boolean(branch?.parent);
}
