import type { PendingSummary } from './pendingSnapshot';

/**
 * What a switch does with the pending changes: nothing to take care of; checkouts that hold no change, undone without
 * asking; an unfinished merge, which no shelve can hold, refused; or changes to shelve, left or brought as the user
 * chooses.
 */
export type SwitchApproach = 'switchAsIs' | 'undoUnchangedCheckouts' | 'refuseMerge' | 'shelveChanges';

export function switchApproach(summary: PendingSummary): SwitchApproach {
  if (summary.pendingCount === 0) return 'switchAsIs';
  if (summary.inMerge) return 'refuseMerge';
  if (summary.unchangedCheckoutsOnly) return 'undoUnchangedCheckouts';
  return 'shelveChanges';
}
