import { useMemo } from 'react';
import { consistentlyIncluded } from './checkinDependencies';
import { checkinSelectionOf, currentChoice, includedBy, type CheckinChoice, type CheckinSelection, type ListedChanges } from './checkinSelection';

/**
 * What a check-in takes of the changes shown, and what follows from it; whether a change is checked holds for all of
 * them (`currentChoice`). Selecting a row or typing the comment renders the view again, so this goes over tens of
 * thousands of changes only when they, the filter or their checks change.
 */
export function useCheckinSelection(listed: ListedChanges, choice: CheckinChoice): CheckinSelection {
  const { all, index } = listed;
  const isIncluded = useMemo(() => consistentlyIncluded(includedBy(currentChoice(choice, all)), index), [choice, all, index]);
  return useMemo(() => checkinSelectionOf(listed, isIncluded), [listed, isIncluded]);
}
