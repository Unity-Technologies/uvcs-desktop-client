import type { IncomingChanges, IncomingSummary } from '@shared/domain/incoming';
import { describeProgressBriefly } from '../../app/operations/describeProgress';
import { ringValue } from '../../app/operations/progressBar';
import type { RunningOperation } from '../../app/operations/runningOperationsStore';

export type IncomingChipState =
  /** `ring`: how full the progress ring is, null to spin. */
  | { kind: 'updating'; stage: string; ring: number | null }
  /** New changesets that don't touch anything changed locally (or not known yet: `checked` is false). */
  | { kind: 'incoming'; branch: string; count: number; countCapped: boolean; checked: boolean }
  /**
   * New changesets that change files also changed locally (`mergeCount`: to merge) or delete or move them
   * (`blockedCount`: to shelve), `conflictCount` in all: never updated blindly.
   */
  | { kind: 'conflicts'; branch: string; count: number; countCapped: boolean; conflictCount: number; mergeCount: number; blockedCount: number };

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

  const { branch, changesetCount: count, countCapped } = summary;
  // Changes read for an older head don't tell about the changesets that came in since.
  if (!changes?.branch || changes.headChangeset !== summary.headChangeset) return { kind: 'incoming', branch, count, countCapped, checked: false };

  const mergeCount = changes.conflicts.length;
  const blockedCount = changes.blockedPaths.length;
  const conflictCount = mergeCount + blockedCount;
  return conflictCount > 0
    ? { kind: 'conflicts', branch, count, countCapped, conflictCount, mergeCount, blockedCount }
    : { kind: 'incoming', branch, count, countCapped, checked: true };
}

/**
 * Whether the chip reads what the update collides with (`useIncomingChanges`: the update's diff and the local changes)
 * to warn about conflicts before anyone hovers, as the native client does. Once per head while the check counted every
 * changeset; once it stopped counting ("100+"), that diff is a heavy read, so it waits for the card to open (Incoming
 * and Update read it too: Update never runs blindly).
 */
export function chipReadsIncomingChanges(summary: IncomingSummary | undefined, cardOpen: boolean): boolean {
  if (!summary?.branch || summary.changesetCount === 0) return false;
  return !summary.countCapped || cardOpen;
}
