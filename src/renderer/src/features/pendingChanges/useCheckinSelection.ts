import { useMemo } from 'react';
import type { PendingChange } from '@shared/domain/pendingChanges';
import { checkinSelectionOf, currentChoice, includedBy, type CheckinChoice, type CheckinSelection } from './checkinSelection';

/**
 * What a check-in takes of the changes shown, and what follows from it; whether a change is checked holds for all of
 * them (`currentChoice`). Selecting a row or typing the comment renders the view again, so this goes over tens of
 * thousands of changes only when they, the filter or their checks change.
 */
export function useCheckinSelection(allChanges: PendingChange[], shownChanges: PendingChange[], choice: CheckinChoice): CheckinSelection {
  const isIncluded = useMemo(() => includedBy(currentChoice(choice, allChanges)), [choice, allChanges]);
  return useMemo(() => checkinSelectionOf(shownChanges, isIncluded), [shownChanges, isIncluded]);
}
