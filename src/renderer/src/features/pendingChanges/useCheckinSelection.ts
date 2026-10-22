import { useMemo } from 'react';
import { checkinSelectionOf, currentChoice, type CheckinChoice, type CheckinSelection, type ListedChanges } from './checkinSelection';

/**
 * What a check-in takes of the changes shown, and what follows from it; whether a change is checked holds for all of
 * them (`currentChoice`). What each change adds is worked out once per read (`ListedChanges.facts`); selecting a row
 * or typing the comment renders the view again, and goes over none of it.
 */
export function useCheckinSelection(listed: ListedChanges, choice: CheckinChoice): CheckinSelection {
  const current = useMemo(() => currentChoice(choice, listed.all), [choice, listed.all]);
  return useMemo(() => checkinSelectionOf(listed, current), [listed, current]);
}
