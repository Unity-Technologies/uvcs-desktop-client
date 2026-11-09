import type { PendingChange } from '@shared/domain/pendingChanges';
import { DEFAULT_SETTINGS, type AppSettings } from '@shared/domain/settings';
import { queryKeys } from '../../api/queryKeys';
import { queryClient } from '../../app/queryClient';
import { bulkPrivateFiles } from '../pendingChanges/bulkPrivate';
import { confirmCheckinWithoutComment } from '../pendingChanges/checkinConfirmations';
import { checkinConfirmed } from '../pendingChanges/confirmedCheckin';
import { askForCheckinComment } from './CheckinCommentDialog';

/**
 * Checks in the changes of the items selected in Files (`filesCheckinChanges`), new files added with them, and
 * nothing else pending: asks for a comment (again, when an empty one is declined and the setting asks about it),
 * then checks in as the Changes panel does (`checkinConfirmed`: the files as they are on disk, a pile of private files
 * and what a folder takes along asked about, an update offered when the branch moved on). The Changes
 * panel's draft comment is left alone: it belongs to its own check-in. True once a changeset is created.
 */
export async function checkinItems(workspacePath: string, changes: PendingChange[], allPending: PendingChange[]): Promise<boolean> {
  const comment = await askForCheckinCommentUntilAgreed(changes.length);
  if (comment === undefined) return false;
  return checkinConfirmed({ workspacePath, changes, allChanges: allPending, comment, bulkPrivate: bulkPrivateFiles(changes) });
}

/** The comment, asked until it has words or the user agrees to go without; `undefined` once cancelled. */
async function askForCheckinCommentUntilAgreed(count: number): Promise<string | undefined> {
  for (;;) {
    const comment = await askForCheckinComment(count);
    if (comment === undefined || comment.trim() || !warnsOnEmptyComment()) return comment;
    if (await confirmCheckinWithoutComment()) return comment;
  }
}

function warnsOnEmptyComment(): boolean {
  return (queryClient.getQueryData<AppSettings>(queryKeys.settings) ?? DEFAULT_SETTINGS).warnOnEmptyComment;
}
