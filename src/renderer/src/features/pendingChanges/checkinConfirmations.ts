import { fileNameOf, listNames, pluralize } from '../../lib/text';
import { confirm } from '../../ui/dialog/confirm';
import { bulkPrivateMessage, type BulkPrivate } from './bulkPrivate';
import type { CheckinPaths } from './checkinPaths';
import { FILTER_LIST_FILES } from './pendingChangeOperations';

/**
 * Asked before a folder takes along changes the user didn't pick: cm can't check in or shelve a folder without
 * everything inside it. Declined, the user picks those too, or leaves the folder out.
 */
export function confirmPulledIn(mode: 'checkin' | 'shelve', plan: CheckinPaths): Promise<boolean> {
  const count = plan.pulledIn.length;
  const action = mode === 'checkin' ? 'check in' : 'shelve';
  return confirm({
    title: `Also ${action} ${pluralize(count, 'change')} inside ${listNames(plan.pullingFolders)}?`,
    message: `A folder is ${mode === 'checkin' ? 'checked in' : 'shelved'} with everything inside it, so ${listNames(plan.pulledIn.map((change) => fileNameOf(change.path)))} ${count === 1 ? 'goes' : 'go'} too.`,
    confirmLabel: `${mode === 'checkin' ? 'Check' : 'Shelve'} ${count === 1 ? 'it' : 'them'}${mode === 'checkin' ? ' in' : ''} too`,
  });
}

/** Asked before a check-in without a comment, when the setting says to. */
export function confirmCheckinWithoutComment(): Promise<boolean> {
  return confirm({
    title: 'Check in without a comment?',
    message: 'A short description helps your team understand the change later.',
    confirmLabel: 'Check in anyway',
  });
}

/** A check-in that adds a pile of private files goes ahead only once confirmed, even from the keyboard. */
export function confirmBulkPrivateCheckin(bulk: BulkPrivate): Promise<boolean> {
  return confirm({
    title: `Check in ${pluralize(bulk.fileCount, 'private file')}?`,
    message: `${bulkPrivateMessage(bulk)}. They are added to version control with this check-in; build output and generated files usually belong in ${FILTER_LIST_FILES.ignore}.`,
    confirmLabel: 'Check in anyway',
  });
}
