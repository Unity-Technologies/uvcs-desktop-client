import { useMemo } from 'react';
import { checkinSelectionOf, currentChoice, includedBy, type CheckinChoice, type CheckinSelection, type ListedChanges } from './checkinSelection';

/**
 * What a check-in takes of the changes shown, and what follows from it; whether a change is checked holds for all of
 * them (`currentChoice`). Selecting a row or typing the comment renders the view again, so this goes over tens of
 * thousands of changes only when they, the filter or their checks change.
 */
export function useCheckinSelection({ all, matchingFilter }: ListedChanges, choice: CheckinChoice): CheckinSelection {
  const isIncluded = useMemo(() => includedBy(currentChoice(choice, all)), [choice, all]);
  return useMemo(() => checkinSelectionOf({ all, matchingFilter }, isIncluded), [all, matchingFilter, isIncluded]);
}
