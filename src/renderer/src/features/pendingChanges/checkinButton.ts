import type { PendingChange } from '@shared/domain/pendingChanges';
import { formatSize } from '../../lib/formatDate';
import { fileNameOf, formatCount, pluralize } from '../../lib/text';

export type CheckinMode = 'checkin' | 'shelve';

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
  /** Shelving keeps the changes in the workspace instead of undoing them. */
  keepShelved?: boolean;
}

/** One wording of the button: the action, then the upload size and "to task", dimmed. */
export interface CheckinButtonText {
  action: string;
  size: string | null;
  target: string | null;
}

interface CheckinButtonLabel {
  /** Shorter and shorter wordings, for the button to show the first that fits; none cuts the action mid-word. */
  forms: CheckinButtonText[];
  /** The tooltip while the button can be used, naming the whole branch. */
  tip: string;
}

/**
 * What the check-in button says, e.g. "Check in 4 changes (1.1 MB) to task": the branch by its leaf, whole in the
 * tooltip. As it narrows, the branch goes first, then the words ("Check in 4"), and the size last: the top bar names
 * the branch, while nothing else tells what the check-in uploads. Behind the branch head it updates first
 * ("Update & check in 4 changes"); once every change is reviewed, "Check in reviewed changes".
 */
export function checkinButtonLabel({ mode, includedCount, branchName, uploadBytes, merging, behindCount, allReviewed, keepShelved }: CheckinButtonState): CheckinButtonLabel {
  const size = includedCount > 0 && uploadBytes > 0 ? formatSize(uploadBytes) : null;
  if (mode === 'shelve') {
    const tip = keepShelved ? 'Shelve a copy; the changes stay here' : 'Shelve, then undo the changes here';
    if (includedCount === 0) return { forms: [{ action: 'Nothing to shelve', size: null, target: null }], tip };
    return { forms: shorterForms(`Shelve ${pluralize(includedCount, 'change')}`, `Shelve ${formatCount(includedCount)}`, '', size), tip };
  }
  if (includedCount === 0) return { forms: [{ action: 'Nothing to check in', size: null, target: null }], tip: 'Check in' };
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
  const target = branchName ? `to ${fileNameOf(branchName)}` : null;
  const short = shortAction ?? action;
  const forms = [
    { action, size, target },
    { action, size, target: null },
    { action: short, size, target: null },
    { action: short, size: null, target: null },
  ];
  return forms.filter((form, index) => forms.findIndex((other) => sameText(other, form)) === index);
}

function sameText(a: CheckinButtonText, b: CheckinButtonText): boolean {
  return a.action === b.action && a.size === b.size && a.target === b.target;
}

/**
 * Why the check-in button can't be used right now, for its tooltip; null when it can. `count` is what the mode takes
 * of the `includedCount` changes checked: a shelve leaves private files and links out (`isShelvable`).
 */
export function checkinDisabledReason(mode: CheckinMode, count: number, includedCount: number): string | null {
  if (count > 0) return null;
  if (mode === 'checkin') return 'Select changes to check in';
  return includedCount > 0 ? "Private files and links can't be shelved" : 'Select changes to shelve';
}

/** The changeset a pending merge comes from, read from the "Merge from 12" tag of its changes. */
export function mergeSourceChangeset(changes: PendingChange[]): number | null {
  for (const change of changes) {
    const match = /Merge from (?:cs:)?(\d+)/.exec(change.mergeInfo ?? '');
    if (match) return Number(match[1]);
  }
  return null;
}
