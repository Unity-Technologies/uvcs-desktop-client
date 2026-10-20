import type { PendingChange } from '@shared/domain/pendingChanges';
import { bulkPrivateFiles, type BulkPrivate } from './bulkPrivate';
import { isCheckinCandidate, isShelvable } from './changeCategories';
import { uploadSummary, type UploadSummary } from './uploadSummary';

export interface CheckinSelection {
  isIncluded: (change: PendingChange) => boolean;
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

/** Whether any of a prepared changelist's files is still pending. */
export function preparedStillPending(prepared: PreparedChangelist, allChanges: PendingChange[]): boolean {
  return allChanges.some((change) => prepared.paths.has(change.path));
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

/** What a check-in of `allChanges` takes, and what follows from it: what it uploads, what a shelve takes, bulk private files. */
export function checkinSelectionOf(allChanges: PendingChange[], isIncluded: (change: PendingChange) => boolean): CheckinSelection {
  const included = allChanges.filter(isIncluded);
  const shelvable = included.filter(isShelvable);
  return {
    isIncluded,
    included,
    upload: uploadSummary(included),
    shelvable,
    shelvableUpload: uploadSummary(shelvable),
    bulkPrivate: bulkPrivateFiles(included),
  };
}
