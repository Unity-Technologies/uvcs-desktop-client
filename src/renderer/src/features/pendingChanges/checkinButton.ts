import type { PendingChange } from '@shared/domain/pendingChanges';
import { formatSize } from '../../lib/formatDate';
import { pluralize } from '../../lib/text';
import { categoryOf, existsOnDisk, hasContentChanges } from './changeCategories';

export type CheckinMode = 'checkin' | 'shelve';

/** The size of the content a check-in uploads: new files and edited ones. Moves, deletions and folders upload nothing. */
export function uploadSize(changes: PendingChange[]): number {
  return changes
    .filter((change) => change.itemType !== 'directory' && existsOnDisk(change))
    .filter((change) => hasContentChanges(change) || ['added', 'private'].includes(categoryOf(change)))
    .reduce((total, change) => total + change.size, 0);
}

interface CheckinButtonState {
  mode: CheckinMode;
  includedCount: number;
  branchName: string;
  uploadBytes: number;
  /** A merge is pending: checking in completes it. */
  merging: boolean;
}

interface CheckinButtonLabel {
  action: string;
  /** "to /main", dimmed after the action. */
  target: string | null;
  /** The upload size, when there is content to upload. */
  size: string | null;
  /** The tooltip while the button can be used. */
  tip: string;
}

/** What the check-in button says, e.g. "Check in 4 changes" "to /main" "1.1 MB". */
export function checkinButtonLabel({ mode, includedCount, branchName, uploadBytes, merging }: CheckinButtonState): CheckinButtonLabel {
  const size = includedCount > 0 && uploadBytes > 0 ? formatSize(uploadBytes) : null;
  if (mode === 'shelve') {
    return { action: includedCount === 0 ? 'Nothing to shelve' : `Shelve ${pluralize(includedCount, 'change')}`, target: null, size, tip: 'Shelve' };
  }
  const target = branchName ? `to ${branchName}` : null;
  if (merging) return { action: 'Check in merge', target, size, tip: 'Check in the merge' };
  if (includedCount === 0) return { action: 'Nothing to check in', target: null, size: null, tip: 'Check in' };
  return { action: `Check in ${pluralize(includedCount, 'change')}`, target, size, tip: 'Check in' };
}

/** Why the check-in button can't be used right now, for its tooltip; null when it can. */
export function checkinDisabledReason(mode: CheckinMode, includedCount: number): string | null {
  if (includedCount > 0) return null;
  return mode === 'checkin' ? 'Select changes to check in' : 'Select changes to shelve';
}

/** The changeset a pending merge comes from, read from the "Merge from 12" tag of its changes. */
export function mergeSourceChangeset(changes: PendingChange[]): number | null {
  for (const change of changes) {
    const match = /Merge from (?:cs:)?(\d+)/.exec(change.mergeInfo ?? '');
    if (match) return Number(match[1]);
  }
  return null;
}
