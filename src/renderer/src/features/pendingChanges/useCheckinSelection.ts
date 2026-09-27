import { useCallback, useMemo } from 'react';
import type { PendingChange } from '@shared/domain/pendingChanges';
import { bulkPrivateFiles, type BulkPrivate } from './bulkPrivate';
import { isCheckinCandidate, isShelvable } from './changeCategories';
import { uploadSize } from './checkinButton';

interface CheckinSelection {
  isIncluded: (change: PendingChange) => boolean;
  /** Every checked change, including those the filter hides: the filter only narrows what is shown. */
  included: PendingChange[];
  uploadBytes: number;
  /** What a shelve takes of them: private files stay out. */
  shelvable: PendingChange[];
  shelvableBytes: number;
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
      uploadBytes: uploadSize(included),
      shelvable,
      shelvableBytes: uploadSize(shelvable),
      bulkPrivate: bulkPrivateFiles(included),
    };
  }, [allChanges, isIncluded]);
}
