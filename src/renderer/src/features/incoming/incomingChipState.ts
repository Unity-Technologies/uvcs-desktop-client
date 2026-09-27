import type { IncomingChanges, IncomingSummary } from '@shared/domain/incoming';
import { describeProgressBriefly } from '../../app/operations/describeProgress';
import { ringValue } from '../../app/operations/progressBar';
import type { RunningOperation } from '../../app/operations/runningOperationsStore';

export type IncomingChipState =
  /** `ring`: how full the progress ring is, null to spin. */
  | { kind: 'updating'; stage: string; ring: number | null }
  /** New changesets that don't touch anything changed locally (or not known yet: `checked` is false). */
  | { kind: 'incoming'; branch: string; count: number; checked: boolean }
  /**
   * New changesets that change files also changed locally (`mergeCount`: to merge) or delete or move them
   * (`blockedCount`: to shelve), `conflictCount` in all: never updated blindly.
   */
  | { kind: 'conflicts'; branch: string; count: number; conflictCount: number; mergeCount: number; blockedCount: number };

/**
 * What the incoming chip shows next to the branch: nothing when the workspace is up to date or not on a branch,
 * the new changesets (and whether they collide with local changes) otherwise, and the stage of a running update.
 */
export function incomingChipState(
  summary: IncomingSummary | undefined,
  changes: IncomingChanges | undefined,
  running: RunningOperation | undefined,
): IncomingChipState | null {
  if (running?.kind === 'update') return { kind: 'updating', stage: describeProgressBriefly(running.progress), ring: ringValue(running.bar) };
  if (!summary?.branch || summary.changesetCount === 0) return null;

  const { branch, changesetCount: count } = summary;
  // Changes read for an older head don't tell about the changesets that came in since.
  if (!changes || changes.headChangeset !== summary.headChangeset) return { kind: 'incoming', branch, count, checked: false };

  const mergeCount = changes.conflicts.length;
  const blockedCount = changes.blockedPaths.length;
  const conflictCount = mergeCount + blockedCount;
  return conflictCount > 0
    ? { kind: 'conflicts', branch, count, conflictCount, mergeCount, blockedCount }
    : { kind: 'incoming', branch, count, checked: true };
}
