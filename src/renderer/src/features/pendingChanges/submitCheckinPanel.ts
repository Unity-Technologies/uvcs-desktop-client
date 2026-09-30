import type { PendingChange } from '@shared/domain/pendingChanges';
import { settleBeforeLeaving } from '../../app/navigation/leaveGuard';
import { joinComment } from '../../lib/comment';
import { pluralize } from '../../lib/text';
import { confirm } from '../../ui/dialog/confirm';
import { bulkPrivateMessage, type BulkPrivate } from './bulkPrivate';
import { checkinChanges, shelveChanges } from './checkinOperations';
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
  /** The checked changes, including those the filter hides. */
  included: PendingChange[];
  /** How many changes are pending in all: checking them all in leaves Changes empty. */
  pendingCount: number;
  /** The incoming check saw the branch move on: the check-in updates first. */
  behind: boolean;
  bulkPrivate: BulkPrivate | null;
  warnOnEmptyComment: boolean;
}

/**
 * The check-in panel's check-in, with the draft's comment: asks about an empty comment (when the setting says to),
 * takes the files as they are on disk (unsaved edits are saved first, or dropped, or it waits), asks about a pile of
 * private files, then checks in. A changeset clears the comment.
 */
export async function checkinFromPanel(request: PanelCheckin, whileRunning: WhileRunning = justRun): Promise<PanelCheckinOutcome> {
  const { workspacePath, included } = request;
  const comment = joinComment(checkinDraftOf(workspacePath));
  if (!comment.trim() && request.warnOnEmptyComment && !(await confirmCheckinWithoutComment())) return 'writeComment';
  if (!(await settleBeforeLeaving())) return 'notCheckedIn';
  if (request.bulkPrivate && !(await confirmBulkPrivateCheckin(request.bulkPrivate))) return 'notCheckedIn';
  const checkedIn = await whileRunning(() =>
    checkinChanges({
      workspacePath,
      changes: included,
      comment,
      updateFirst: request.behind,
      quiet: successCardTellsCheckin(included.length, request.pendingCount),
    }),
  );
  if (!checkedIn) return 'notCheckedIn';
  useCheckinDraftStore.getState().clearMessage(workspacePath);
  return 'checkedIn';
}

/**
 * The check-in panel's shelve, with the draft's comment, of the files as they are on disk (as a check-in takes them).
 * Shelved away, the changes take their comment along; kept here, it stays for their check-in. True once shelved.
 */
export async function shelveFromPanel(workspacePath: string, shelvable: PendingChange[], keep: boolean, whileRunning: WhileRunning = justRun): Promise<boolean> {
  if (!(await settleBeforeLeaving())) return false;
  const shelved = await whileRunning(() => shelveChanges(workspacePath, shelvable, joinComment(checkinDraftOf(workspacePath)), keep));
  if (shelved && !keep) useCheckinDraftStore.getState().clearMessage(workspacePath);
  return shelved;
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
