import type { PendingChange } from '@shared/domain/pendingChanges';
import { settleBeforeLeaving } from '../../app/navigation/leaveGuard';
import { joinComment } from '../../lib/comment';
import { fileNameOf, listNames, pluralize } from '../../lib/text';
import { confirm } from '../../ui/dialog/confirm';
import { bulkPrivateMessage, type BulkPrivate } from './bulkPrivate';
import { checkinChanges, shelveChanges } from './checkinOperations';
import { checkinPathsOf, foldersPullingIn, type CheckinPaths } from './checkinPaths';
import { checkinDraftOf, useCheckinDraftStore } from './checkinDraftStore';
import { FILTER_LIST_FILES } from './pendingChangeOperations';
import { successCardTellsCheckin } from './successMoment';

/** Runs the check-in or shelve itself, once everything is confirmed: the panel shows it busy meanwhile. */
export type WhileRunning = <T>(run: () => Promise<T>) => Promise<T>;

const justRun: WhileRunning = (run) => run();

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
 * takes the files as they are on disk (unsaved edits are saved first, or dropped, or it waits), asks about a pile of
 * private files and about the changes a folder takes along unchecked (`checkinPathsOf`), then checks in. A changeset
 * clears the comment.
 */
export async function checkinFromPanel(request: PanelCheckin, whileRunning: WhileRunning = justRun): Promise<PanelCheckinOutcome> {
  const { workspacePath, included } = request;
  const comment = joinComment(checkinDraftOf(workspacePath));
  if (!comment.trim() && request.warnOnEmptyComment && !(await confirmCheckinWithoutComment())) return 'writeComment';
  if (!(await settleBeforeLeaving())) return 'notCheckedIn';
  if (request.bulkPrivate && !(await confirmBulkPrivateCheckin(request.bulkPrivate))) return 'notCheckedIn';
  const { paths, addsPrivate, pulledIn } = checkinPathsOf(included, request.allChanges);
  if (pulledIn.length > 0 && !(await confirmPulledIn('checkin', { paths, addsPrivate, pulledIn }))) return 'notCheckedIn';
  const changes = [...included, ...pulledIn];
  const checkedIn = await whileRunning(() =>
    checkinChanges({
      workspacePath,
      changes,
      paths,
      addsPrivate,
      comment,
      updateFirst: request.behind,
      quiet: successCardTellsCheckin(changes.length, request.allChanges.length),
    }),
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

/**
 * Asked before a folder takes along changes the user didn't check: cm can't check in or shelve a folder without
 * everything inside it. Declined, the user checks those too, or unchecks the folder.
 */
function confirmPulledIn(mode: 'checkin' | 'shelve', plan: CheckinPaths): Promise<boolean> {
  const count = plan.pulledIn.length;
  const action = mode === 'checkin' ? 'check in' : 'shelve';
  return confirm({
    title: `Also ${action} ${pluralize(count, 'change')} inside ${listNames(foldersPullingIn(plan))}?`,
    message: `A folder is ${mode === 'checkin' ? 'checked in' : 'shelved'} with everything inside it, so ${listNames(plan.pulledIn.map((change) => fileNameOf(change.path)))} ${count === 1 ? 'goes' : 'go'} too.`,
    confirmLabel: `${mode === 'checkin' ? 'Check' : 'Shelve'} ${count === 1 ? 'it' : 'them'}${mode === 'checkin' ? ' in' : ''} too`,
  });
}

/** Asked before a check-in without a comment, when the setting says to. */
function confirmCheckinWithoutComment(): Promise<boolean> {
  return confirm({
    title: 'Check in without a comment?',
    message: 'A short description helps your team understand the change later.',
    confirmLabel: 'Check in anyway',
  });
}

/** A check-in that adds a pile of private files goes ahead only once confirmed, even from the keyboard. */
function confirmBulkPrivateCheckin(bulk: BulkPrivate): Promise<boolean> {
  return confirm({
    title: `Check in ${pluralize(bulk.fileCount, 'private file')}?`,
    message: `${bulkPrivateMessage(bulk)}. They are added to version control with this check-in; build output and generated files usually belong in ${FILTER_LIST_FILES.ignore}.`,
    confirmLabel: 'Check in anyway',
  });
}
