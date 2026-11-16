import { BRANCH_REVIEWS_BLOCK } from '@shared/domain/codeReview';

/**
 * `cm find review`'s condition for the reviews of several branches, by object id: their `targetid`s ORed, kept to
 * branches (`targetid` alone matches a changeset of the same number). `cm find` has no `in (...)`; unlike ids ORed in
 * other finds (`noOredIdLookups.test.ts`), the server answers these in one scan of its reviews, so a block of
 * `BRANCH_REVIEWS_BLOCK` costs what one does (docs/features/merge-requests.md "Where a branch's merge request shows").
 */
export function branchTargetsCondition(branchIds: readonly number[]): string {
  if (branchIds.length === 0) throw new Error('No branches to read the reviews of.');
  if (branchIds.length > BRANCH_REVIEWS_BLOCK) throw new Error(`At most ${BRANCH_REVIEWS_BLOCK} branches per read of their reviews.`);
  if (!branchIds.every(Number.isSafeInteger)) throw new Error('A branch id is a whole number.');
  const targets = branchIds.map((branchId) => `targetid = ${branchId}`);
  return `(${targets.join(' or ')}) and targettype = 'branch'`;
}
