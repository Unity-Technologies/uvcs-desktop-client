import type { Branch } from '@shared/domain/branch';
import type { CodeReviewSummary } from '@shared/domain/codeReview';
import { firstLine } from '../../lib/text';

/** "Merge /main/t1: Add the login screen", or just "Merge /main/t1" when the branch has no comment. */
export function defaultMergeComment(branch: Pick<Branch, 'name' | 'comment'>): string {
  const summary = firstLine(branch.comment);
  return summary ? `Merge ${branch.name}: ${summary}` : `Merge ${branch.name}`;
}

/** Whether the merge can also mark the branch's review as reviewed: there is one, and it isn't yet. */
export function canMarkReviewed(review: CodeReviewSummary | undefined): review is CodeReviewSummary {
  return review !== undefined && review.status !== 'Reviewed';
}

/** Whether a branch looks like a task branch that can be finished by merging it to its parent. */
export function isTaskBranch(branch: Pick<Branch, 'parent'> | undefined): branch is Branch {
  return Boolean(branch?.parent);
}
