import type { PendingChange } from '@shared/domain/pendingChanges';
import { formatSize } from '../../lib/formatDate';
import { fileNameOf, formatCount, pluralize } from '../../lib/text';
import { categoryOf, existsOnDisk, hasContentChanges, isControlled } from './changeCategories';

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
  /** Changesets on the branch the workspace doesn't have yet: the button updates first. */
  behindCount: number;
  /** Review mode is on and every change checked in is reviewed. */
  allReviewed: boolean;
}

/** One wording of the button: the action, then "to /main" and the upload size, dimmed. */
export interface CheckinButtonText {
  action: string;
  target: string | null;
  size: string | null;
}

interface CheckinButtonLabel {
  /** Shorter and shorter wordings, for the button to show the first that fits; none cuts the action mid-word. */
  forms: CheckinButtonText[];
  /** The tooltip while the button can be used, naming the whole branch. */
  tip: string;
}

/**
 * What the check-in button says, e.g. "Check in 4 changes" "to /main/task" "1.1 MB"; as it narrows, without the size,
 * with the branch's leaf only ("to task"), without the branch and finally "Check in 4". Behind the branch head it
 * updates first ("Update & check in 4 changes"); once every change is reviewed, "Check in reviewed changes".
 */
export function checkinButtonLabel({ mode, includedCount, branchName, uploadBytes, merging, behindCount, allReviewed }: CheckinButtonState): CheckinButtonLabel {
  const size = includedCount > 0 && uploadBytes > 0 ? formatSize(uploadBytes) : null;
  if (mode === 'shelve') {
    if (includedCount === 0) return { forms: [{ action: 'Nothing to shelve', target: null, size: null }], tip: 'Shelve' };
    return { forms: shorterForms(`Shelve ${pluralize(includedCount, 'change')}`, `Shelve ${formatCount(includedCount)}`, '', size), tip: 'Shelve' };
  }
  if (includedCount === 0) return { forms: [{ action: 'Nothing to check in', target: null, size: null }], tip: 'Check in' };
  const tip = branchName ? `Check in to ${branchName}` : 'Check in';
  if (merging) return { forms: shorterForms('Check in merge', null, branchName, size), tip };
  if (behindCount > 0) {
    const behindTip = branchName ? `Update, then check in to ${branchName}` : 'Update, then check in';
    return { forms: shorterForms(`Update & check in ${pluralize(includedCount, 'change')}`, `Update & check in ${formatCount(includedCount)}`, branchName, size), tip: behindTip };
  }
  if (allReviewed) return { forms: shorterForms('Check in reviewed changes', `Check in ${formatCount(includedCount)}`, branchName, size), tip };
  return { forms: shorterForms(`Check in ${pluralize(includedCount, 'change')}`, `Check in ${formatCount(includedCount)}`, branchName, size), tip };
}

function shorterForms(action: string, shortAction: string | null, branchName: string, size: string | null): CheckinButtonText[] {
  const target = branchName ? `to ${branchName}` : null;
  // A top-level branch is its own leaf.
  const leafTarget = branchName.lastIndexOf('/') > 0 ? `to ${fileNameOf(branchName)}` : null;
  const forms = [
    { action, target, size },
    size && { action, target, size: null },
    leafTarget && { action, target: leafTarget, size: null },
    target && { action, target: null, size: null },
    shortAction && { action: shortAction, target: null, size: null },
  ];
  return forms.filter((form): form is CheckinButtonText => Boolean(form));
}

/**
 * Why the check-in button can't be used right now, for its tooltip; null when it can. `count` is what the mode takes
 * of the `includedCount` changes checked: a shelve leaves private files out.
 */
export function checkinDisabledReason(mode: CheckinMode, count: number, includedCount: number): string | null {
  if (count > 0) return null;
  if (mode === 'checkin') return 'Select changes to check in';
  return includedCount > 0 ? "Private files can't be shelved" : 'Select changes to shelve';
}

/** What a shelve takes of the changes checked: `cm` shelves only what is under version control. */
export function shelvableChanges(changes: PendingChange[]): PendingChange[] {
  return changes.filter(isControlled);
}

/** The changeset a pending merge comes from, read from the "Merge from 12" tag of its changes. */
export function mergeSourceChangeset(changes: PendingChange[]): number | null {
  for (const change of changes) {
    const match = /Merge from (?:cs:)?(\d+)/.exec(change.mergeInfo ?? '');
    if (match) return Number(match[1]);
  }
  return null;
}
