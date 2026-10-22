import { useMemo } from 'react';
import { consistentlyIncluded } from './checkinDependencies';
import { checkinSelectionOf, currentChoice, includedBy, type CheckinChoice, type CheckinSelection, type ListedChanges } from './checkinSelection';

/**
 * What a check-in takes of the changes shown, and what follows from it; whether a change is checked holds for all of
 * them (`currentChoice`). What each change adds is worked out once per read (`ListedChanges.facts`); selecting a row
 * or typing the comment renders the view again, and goes over none of it.
 */
export function useCheckinSelection(listed: ListedChanges, choice: CheckinChoice): CheckinSelection {
  const { all, index } = listed;
  const current = useMemo(() => currentChoice(choice, all), [choice, all]);
  const isIncluded = useMemo(() => consistentlyIncluded(includedBy(current), index), [current, index]);
  const everyChecked = !current.prepared && current.excludedPaths.size === 0;
  return useMemo(() => checkinSelectionOf(listed, isIncluded, everyChecked), [listed, isIncluded, everyChecked]);
}
