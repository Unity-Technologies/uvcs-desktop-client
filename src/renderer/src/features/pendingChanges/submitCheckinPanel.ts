import type { PendingChange } from '@shared/domain/pendingChanges';
import { settleBeforeLeaving } from '../../app/navigation/leaveGuard';
import { joinComment } from '../../lib/comment';
import type { BulkPrivate } from './bulkPrivate';
import { confirmCheckinWithoutComment, confirmPulledIn } from './checkinConfirmations';
import { shelveChanges } from './checkinOperations';
import { checkinPathsOf } from './checkinPaths';
import { checkinDraftOf, useCheckinDraftStore } from './checkinDraftStore';
import { checkinConfirmed, justRun, type WhileRunning } from './confirmedCheckin';

/** How a check-in from the panel ended: a changeset, nothing (cancelled or failed), or the user wants to write a comment. */
export type PanelCheckinOutcome = 'checkedIn' | 'notCheckedIn' | 'writeComment';

export interface PanelCheckin {
  workspacePath: string;
  /** The checked changes the filter shows (`checkinSelectionOf`). */
  included: PendingChange[];
  /** How many checked changes the filter hides: a prepared changelist holds for them. */
  hiddenIncludedCount: number;
  /** Every pending change: what a folder given to cm takes along, and whether Changes ends up empty. */
  allChanges: PendingChange[];
  /** The incoming check saw the branch move on: the check-in updates first. */
  behind: boolean;
  bulkPrivate: BulkPrivate | null;
  warnOnEmptyComment: boolean;
}

/**
 * The check-in panel's check-in, with the draft's comment: asks about an empty comment (when the setting says to),
 * then checks in as every check-in does (`checkinConfirmed`). A changeset clears the comment.
 */
export async function checkinFromPanel(request: PanelCheckin, whileRunning: WhileRunning = justRun): Promise<PanelCheckinOutcome> {
  const { workspacePath } = request;
  const comment = joinComment(checkinDraftOf(workspacePath));
  if (!comment.trim() && request.warnOnEmptyComment && !(await confirmCheckinWithoutComment())) return 'writeComment';
  const checkedIn = await checkinConfirmed(
    { workspacePath, changes: request.included, allChanges: request.allChanges, comment, bulkPrivate: request.bulkPrivate, updateFirst: request.behind },
    whileRunning,
  );
  if (!checkedIn) return 'notCheckedIn';
  useCheckinDraftStore.getState().clearMessage(workspacePath);
  endPreparedUnlessHidden(workspacePath, request.hiddenIncludedCount);
  return 'checkedIn';
}

/** What the check-in panel's shelve takes. */
export interface PanelShelve {
  workspacePath: string;
  /** What a shelve takes of the checked changes the filter shows. */
  shelvable: PendingChange[];
  /** How many checked changes the filter hides: a prepared changelist holds for them. */
  hiddenIncludedCount: number;
  /** Every pending change: what a folder given to cm takes along. */
  allChanges: PendingChange[];
}

/**
 * The check-in panel's shelve, with the draft's comment, of the files as they are on disk (as a check-in takes them).
 * Shelved away, the changes take their comment along; kept here, it stays for their check-in. True once shelved.
 */
export async function shelveFromPanel(request: PanelShelve, keep: boolean, whileRunning: WhileRunning = justRun): Promise<boolean> {
  const { workspacePath, shelvable } = request;
  if (!(await settleBeforeLeaving())) return false;
  const plan = checkinPathsOf(shelvable, request.allChanges);
  if (plan.pulledIn.length > 0 && !(await confirmPulledIn('shelve', plan))) return false;
  const shelved = await whileRunning(() =>
    shelveChanges({ workspacePath, changes: [...shelvable, ...plan.pulledIn], paths: plan.paths, comment: joinComment(checkinDraftOf(workspacePath)), keep }),
  );
  if (shelved && !keep) useCheckinDraftStore.getState().clearMessage(workspacePath);
  if (shelved) endPreparedUnlessHidden(workspacePath, request.hiddenIncludedCount);
  return shelved;
}

/**
 * Ends a prepared changelist once checked in or shelved, unless the filter hid some of its checked files: those are
 * still to go in, checked alone. Files the user unchecked by hand were left out on purpose, and don't keep it going.
 */
function endPreparedUnlessHidden(workspacePath: string, hiddenIncludedCount: number): void {
  if (hiddenIncludedCount === 0) useCheckinDraftStore.getState().endPrepared(workspacePath);
}
