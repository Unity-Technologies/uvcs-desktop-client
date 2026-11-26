import type { CodeReview, CodeReviewSummary } from './codeReview';

/**
 * The branches reviews target, by object id, each once: what naming them asks for (`CodeReviewsApi.branchNames`).
 * Reviews of a changeset or a shelve come named and ask for nothing.
 */
export function branchTargetIdsOf(reviews: readonly CodeReviewSummary[]): number[] {
  const ids = new Set<number>();
  for (const { targetBranchId } of reviews) if (targetBranchId !== undefined) ids.add(targetBranchId);
  return [...ids];
}

/**
 * The review with its target named: a branch by its name in `branchNames` (by object id), "an unknown branch" when it
 * has none there (a branch deleted since); a changeset or shelve as listed; anything else as changes of an unknown kind.
 */
export function withTargetNamed(review: CodeReviewSummary, branchNames: Readonly<Record<number, string>>): CodeReview {
  if (review.target) return { ...review, target: review.target };
  if (review.targetBranchId === undefined) return { ...review, target: { kind: 'unknown', description: 'changes of an unknown kind' } };
  const branch = branchNames[review.targetBranchId];
  return { ...review, target: branch !== undefined ? { kind: 'branch', branch } : { kind: 'unknown', description: 'an unknown branch' } };
}
