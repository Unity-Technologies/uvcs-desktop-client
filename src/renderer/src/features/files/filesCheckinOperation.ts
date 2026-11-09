import type { PendingChange } from '@shared/domain/pendingChanges';
import { DEFAULT_SETTINGS, type AppSettings } from '@shared/domain/settings';
import { queryKeys } from '../../api/queryKeys';
import { settleBeforeLeaving } from '../../app/navigation/leaveGuard';
import { queryClient } from '../../app/queryClient';
import { bulkPrivateFiles } from '../pendingChanges/bulkPrivate';
import { confirmBulkPrivateCheckin, confirmCheckinWithoutComment, confirmPulledIn } from '../pendingChanges/checkinConfirmations';
import { checkinChanges } from '../pendingChanges/checkinOperations';
import { checkinPathsOf } from '../pendingChanges/checkinPaths';
import { successCardTellsCheckin } from '../pendingChanges/successMoment';
import { askForCheckinComment } from './CheckinCommentDialog';

/**
 * Checks in the changes of the items selected in Files (`filesCheckinChanges`), new files added with them, and
 * nothing else pending: asks for a comment (again, when an empty one is declined and the setting asks about it),
 * takes the files as they are on disk, asks about a pile of private files and about what a folder takes along, then
 * checks in as the Changes panel does (`checkinChanges`, which offers to update when the branch moved on). The Changes
 * panel's draft comment is left alone: it belongs to its own check-in. True once a changeset is created.
 */
export async function checkinItems(workspacePath: string, changes: PendingChange[], allPending: PendingChange[]): Promise<boolean> {
  const comment = await askForComment(changes.length);
  if (comment === undefined) return false;
  if (!(await settleBeforeLeaving())) return false;
  const bulk = bulkPrivateFiles(changes);
  if (bulk && !(await confirmBulkPrivateCheckin(bulk))) return false;
  const plan = checkinPathsOf(changes, allPending);
  if (plan.pulledIn.length > 0 && !(await confirmPulledIn('checkin', plan))) return false;
  const checkedIn = [...changes, ...plan.pulledIn];
  return checkinChanges({
    workspacePath,
    changes: checkedIn,
    paths: plan.paths,
    addsPrivate: plan.addsPrivate,
    comment,
    quiet: successCardTellsCheckin(checkedIn.length, allPending.length),
  });
}

/** The comment, asked until it has words or the user agrees to go without; `undefined` once cancelled. */
async function askForComment(count: number): Promise<string | undefined> {
  for (;;) {
    const comment = await askForCheckinComment(count);
    if (comment === undefined || comment.trim() || !warnsOnEmptyComment()) return comment;
    if (await confirmCheckinWithoutComment()) return comment;
  }
}

function warnsOnEmptyComment(): boolean {
  return (queryClient.getQueryData<AppSettings>(queryKeys.settings) ?? DEFAULT_SETTINGS).warnOnEmptyComment;
}
