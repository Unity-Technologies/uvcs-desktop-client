import type { MergePlan } from '@shared/domain/merge';

/**
 * Whether the merge page has nothing left to keep when the user leaves it (`MergeInProgress.settled`): it completed,
 * or its plan says there is nothing it can do (nothing to merge, pending changes in the way). While it calculates, is
 * ready, or failed to calculate (it offers to try again), it is a merge in progress.
 */
export function mergeSettled(planStatus: MergePlan['status'] | undefined, completed: boolean): boolean {
  return completed || (planStatus !== undefined && planStatus !== 'ready');
}
