import type { Changeset } from '@shared/domain/changeset';
import type { BranchIncomingChanges, IncomingChanges, IncomingSummary } from '@shared/domain/incoming';
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
  const read = sameHeadChanges(summary, changes);
  if (!read) return { kind: 'incoming', branch, count, countCapped, checked: false };
  changes = read;

  const mergeCount = changes.conflicts.length;
  const blockedCount = changes.blockedPaths.length;
  const conflictCount = mergeCount + blockedCount;
  return conflictCount > 0
    ? { kind: 'conflicts', branch, count, countCapped, conflictCount, mergeCount, blockedCount }
    : { kind: 'incoming', branch, count, countCapped, checked: true };
}

/** The incoming changes read for the head the check last saw; undefined while none are, or they are for an older head. */
function sameHeadChanges(summary: IncomingSummary | undefined, changes: IncomingChanges | undefined): BranchIncomingChanges | undefined {
  return summary?.branch && changes?.branch && changes.headChangeset === summary.headChangeset ? changes : undefined;
}

/**
 * Whether the chip reads what the update collides with (`useIncomingChanges`: the update's diff and the local changes)
 * to warn about conflicts before anyone hovers, as the native client does. Once per head while the check counted every
 * changeset; once it stopped counting ("100+"), that diff is a heavy read, so a hover never starts it: only pinning the
 * card does (and Incoming, and Update, which reads it again right before updating: never blindly).
 */
export function chipReadsIncomingChanges(summary: IncomingSummary | undefined, cardPinned: boolean): boolean {
  if (!summary?.branch || summary.changesetCount === 0) return false;
  return !summary.countCapped || cardPinned;
}

/** How many changesets the incoming card lists before "and N more". */
export const NEWEST_IN_CARD = 5;

/**
 * What the incoming card lists: the newest of the incoming changes already read for this head, or else those it read
 * itself (`cardReadsNewest`); undefined while neither is in.
 */
export function cardChangesets(summary: IncomingSummary | undefined, changes: IncomingChanges | undefined, newest: Changeset[] | undefined): Changeset[] | undefined {
  return (sameHeadChanges(summary, changes)?.changesets ?? newest)?.slice(0, NEWEST_IN_CARD);
}

/**
 * Whether the open card reads its newest changesets itself (one `cm find … limit`): only past the check's count, where
 * the chip reads nothing up front, and only while nothing was read for this head. Below it, the chip's read lists them.
 */
export function cardReadsNewest(summary: IncomingSummary | undefined, changes: IncomingChanges | undefined, open: boolean): boolean {
  return open && Boolean(summary?.branch && summary.countCapped) && !sameHeadChanges(summary, changes);
}

/**
 * Whether the card says its changesets couldn't be read: it has none to list, and every read it waits on failed (the
 * incoming changes the chip reads, `chipReadsIncomingChanges`, and its own read of the newest, `cardReadsNewest`).
 */
export function cardFailed(
  summary: IncomingSummary | undefined,
  changes: IncomingChanges | undefined,
  card: { open: boolean; pinned: boolean },
  failed: { changes: boolean; newest: boolean },
): boolean {
  if (cardChangesets(summary, changes, undefined)) return false;
  const waited = [
    ...(chipReadsIncomingChanges(summary, card.open && card.pinned) ? [failed.changes] : []),
    ...(cardReadsNewest(summary, changes, card.open) ? [failed.newest] : []),
  ];
  return waited.length > 0 && waited.every(Boolean);
}

/**
 * What the card says, past the check's count, about checking the incoming changes against the local ones: that a click
 * checks them (pinning reads them, `chipReadsIncomingChanges`), that it is checking, or that the check failed. Nothing
 * below the count, where the chip checked up front, nor once this head was checked (the conflicts show, or none).
 */
export type CardCheck = 'unchecked' | 'checking' | 'failed' | null;

export function cardCheck(summary: IncomingSummary | undefined, changes: IncomingChanges | undefined, card: { pinned: boolean }, checkFailed: boolean): CardCheck {
  if (!summary?.branch || !summary.countCapped || sameHeadChanges(summary, changes)) return null;
  if (!card.pinned) return 'unchecked';
  return checkFailed ? 'failed' : 'checking';
}

/**
 * One count on every screen: the check's, until the incoming changes are read for the same head, which count further
 * (up to a page instead of the check's 100) and name more authors; exact once Incoming read every older page for that
 * head (`listed` with no more). It never goes down. The chip, the sidebar and the status bar show this.
 */
export function knownIncomingSummary(
  summary: IncomingSummary | undefined,
  changes: IncomingChanges | undefined,
  listed?: { changesets: readonly unknown[]; more: boolean },
): IncomingSummary | undefined {
  const read = sameHeadChanges(summary, changes);
  if (!summary?.branch || !read) return summary;
  const known = listed && !listed.more ? { changesetCount: listed.changesets.length, countCapped: false } : read;
  const best = known.changesetCount >= read.changesetCount ? known : read;
  if (best.changesetCount <= summary.changesetCount) return summary;
  return { ...summary, changesetCount: best.changesetCount, countCapped: best.countCapped, authors: read.authors };
}
