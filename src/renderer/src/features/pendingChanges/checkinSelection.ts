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

/** Whether a change goes into the check-in: any that can be checked in, unless its box was unchecked. */
export function includedBy(excludedPaths: ReadonlySet<string>): (change: PendingChange) => boolean {
  return (change) => isCheckinCandidate(change) && !excludedPaths.has(change.path);
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
