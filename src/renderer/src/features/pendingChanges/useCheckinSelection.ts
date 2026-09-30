import { useMemo } from 'react';
import type { PendingChange } from '@shared/domain/pendingChanges';
import { checkinSelectionOf, includedBy, type CheckinSelection } from './checkinSelection';

/**
 * What a check-in takes and what follows from it. Selecting a row or typing the comment renders the view again, so
 * this goes over tens of thousands of changes only when they or their checks change.
 */
export function useCheckinSelection(allChanges: PendingChange[], excludedPaths: ReadonlySet<string>): CheckinSelection {
  const isIncluded = useMemo(() => includedBy(excludedPaths), [excludedPaths]);
  return useMemo(() => checkinSelectionOf(allChanges, isIncluded), [allChanges, isIncluded]);
}
