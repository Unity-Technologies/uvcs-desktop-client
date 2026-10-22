import type { PendingChange } from '@shared/domain/pendingChanges';
import { BulkPrivateTally, bulkPrivateFiles, isPrivateFolderAt, privateFoldersOf, type BulkPrivate, type PrivateFolders } from './bulkPrivate';
import { isCheckinCandidate, isShelvable } from './changeCategories';
import { UploadTally, uploadKindOf, type UploadKind, type UploadSummary } from './uploadSummary';

export interface CheckinSelection {
  isIncluded: (change: PendingChange) => boolean;
  /** Whether a change that can go into the check-in is checked; null when every one is, so nothing needs asking. */
  isChosen: ((change: PendingChange) => boolean) | null;
  /** Every checked change, including those the filter hides: the filter only narrows what is shown. */
  included: PendingChange[];
  upload: UploadSummary;
  /** What a shelve takes of them: private files stay out. */
  shelvable: PendingChange[];
  shelvableUpload: UploadSummary;
  bulkPrivate: BulkPrivate | null;
}

/**
 * A changelist readied to check in or shelve alone ("Check in this changelist"): only these paths go in, so a change
 * that appears meanwhile (an editor saving, a new `.meta`) stays out. Checking files by hand adds or takes them here.
 */
export interface PreparedChangelist {
  name: string;
  paths: ReadonlySet<string>;
}

/** What the user checked for the next check-in. */
export interface CheckinChoice {
  /** Paths the user unchecked. New changes are included by default, so we remember exclusions. */
  excludedPaths: ReadonlySet<string>;
  /** While set, it alone says what goes in; `excludedPaths` waits, as it was, for it to end. */
  prepared: PreparedChangelist | null;
}

/** Whether a change goes into the check-in: any that can be checked in, unless its box was unchecked. */
export function includedBy({ excludedPaths, prepared }: CheckinChoice): (change: PendingChange) => boolean {
  if (prepared) return (change) => isCheckinCandidate(change) && prepared.paths.has(change.path);
  return (change) => isCheckinCandidate(change) && !excludedPaths.has(change.path);
}

/** The choice once the user checks every file, none hidden: no changelist prepared, and none of `paths` left out. */
export function withEverythingIncluded(choice: CheckinChoice, paths: string[]): CheckinChoice {
  return { prepared: null, excludedPaths: withIncluded({ ...choice, prepared: null }, paths, true).excludedPaths };
}

/**
 * Whether the prepared changelist still holds a pending change, checked or not. By the changelist, not the paths: an
 * added file undone stays on disk, private, at its path, and files the user checked besides don't keep it going.
 */
export function preparedStillPending(prepared: PreparedChangelist, allChanges: PendingChange[]): boolean {
  return allChanges.some((change) => change.changelist === prepared.name);
}

/**
 * The choice that holds for `allChanges`: a prepared changelist none of whose files is pending anymore (undone, shelved
 * away by a switch, checked in from outside the app) has ended, and the files the user left out are the only ones out.
 */
export function currentChoice(choice: CheckinChoice, allChanges: PendingChange[]): CheckinChoice {
  return choice.prepared && !preparedStillPending(choice.prepared, allChanges) ? { ...choice, prepared: null } : choice;
}

/** The choice once the user checks (or unchecks) `paths` by hand: in a prepared changelist's paths while there is one. */
export function withIncluded(choice: CheckinChoice, paths: string[], included: boolean): CheckinChoice {
  if (choice.prepared) {
    const preparedPaths = new Set(choice.prepared.paths);
    paths.forEach((path) => (included ? preparedPaths.add(path) : preparedPaths.delete(path)));
    return { ...choice, prepared: { ...choice.prepared, paths: preparedPaths } };
  }
  const excludedPaths = new Set(choice.excludedPaths);
  paths.forEach((path) => (included ? excludedPaths.delete(path) : excludedPaths.add(path)));
  return { ...choice, excludedPaths };
}

/**
 * The changes of a read that can go into a check-in, with what each adds to one worked out once for the read: a click
 * on a box then only goes over them asking whether each is checked (`checkinSelectionOf`), where working it all out
 * again took a third of a second a click for a million changes. Everything checked, the read's own selection.
 */
export interface CheckinCandidates {
  changes: PendingChange[];
  uploadKinds: UploadKind[];
  shelvable: Uint8Array;
  privateFolders: PrivateFolders;
  everything: Omit<CheckinSelection, 'isIncluded' | 'isChosen'>;
}

export function checkinCandidatesOf(allChanges: PendingChange[]): CheckinCandidates {
  const changes = allChanges.filter(isCheckinCandidate);
  const facts = { changes, uploadKinds: changes.map(uploadKindOf), shelvable: Uint8Array.from(changes, (change) => (isShelvable(change) ? 1 : 0)), privateFolders: privateFoldersOf(changes) };
  return { ...facts, everything: selectionOf(facts, () => true) };
}

/** What a check-in of the candidates takes as the user chose (`currentChoice`), and what follows from it: what it uploads, what a shelve takes, bulk private files. */
export function checkinSelectionOf(candidates: CheckinCandidates, choice: CheckinChoice): CheckinSelection {
  const isIncluded = includedBy(choice);
  if (!choice.prepared && choice.excludedPaths.size === 0) return { isIncluded, isChosen: null, ...candidates.everything };
  const { prepared, excludedPaths } = choice;
  const isChosen = prepared ? (change: PendingChange) => prepared.paths.has(change.path) : (change: PendingChange) => !excludedPaths.has(change.path);
  return { isIncluded, isChosen, ...selectionOf(candidates, isChosen) };
}

/** One pass over the candidates, taking those `isChosen` takes. */
function selectionOf(candidates: Omit<CheckinCandidates, 'everything'>, isChosen: (change: PendingChange) => boolean): Omit<CheckinSelection, 'isIncluded' | 'isChosen'> {
  const { changes, uploadKinds, shelvable: canShelve, privateFolders } = candidates;
  const included: PendingChange[] = [];
  const shelvable: PendingChange[] = [];
  const [upload, shelvableUpload] = [new UploadTally(), new UploadTally()];
  const bulk = new BulkPrivateTally(privateFolders);
  let privateFolderLeftOut = false;
  changes.forEach((change, index) => {
    if (!isChosen(change)) {
      privateFolderLeftOut ||= isPrivateFolderAt(privateFolders, index);
      return;
    }
    const kind = uploadKinds[index];
    included.push(change);
    upload.add(change, kind);
    if (canShelve[index]) {
      shelvable.push(change);
      shelvableUpload.add(change, kind);
    }
    bulk.add(change, index);
  });
  return {
    included,
    upload: upload.summary(),
    shelvable,
    shelvableUpload: shelvableUpload.summary(),
    // Without one of their private folders, files are counted in another: worked out again for them.
    bulkPrivate: privateFolderLeftOut ? bulkPrivateFiles(included) : bulk.result(),
  };
}

/**
 * How many of the shown changes are checked: all that are, when the list shows every change (no filter), counted
 * again only while a filter leaves some out.
 */
export function shownIncludedCount(shown: PendingChange[], allCount: number, selection: Pick<CheckinSelection, 'included' | 'isIncluded'>): number {
  if (shown.length === allCount) return selection.included.length;
  let count = 0;
  for (const change of shown) if (selection.isIncluded(change)) count++;
  return count;
}
