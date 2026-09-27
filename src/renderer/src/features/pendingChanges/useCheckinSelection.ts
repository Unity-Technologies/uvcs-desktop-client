import { useCallback, useMemo } from 'react';
import type { PendingChange } from '@shared/domain/pendingChanges';
import { bulkPrivateFiles, type BulkPrivate } from './bulkPrivate';
import { isCheckinCandidate, isShelvable } from './changeCategories';
import { uploadSummary, type UploadSummary } from './uploadSummary';

interface CheckinSelection {
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
 * What a check-in takes and what follows from it. Selecting a row or typing the comment renders the view again, so
 * this goes over tens of thousands of changes only when they or their checks change.
 */
export function useCheckinSelection(allChanges: PendingChange[], excludedPaths: ReadonlySet<string>): CheckinSelection {
  const isIncluded = useCallback((change: PendingChange) => isCheckinCandidate(change) && !excludedPaths.has(change.path), [excludedPaths]);
  return useMemo(() => {
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
  }, [allChanges, isIncluded]);
}
