import { useMemo } from 'react';
import type { PendingChange } from '@shared/domain/pendingChanges';
import { checkinCandidatesOf, checkinSelectionOf, currentChoice, type CheckinChoice, type CheckinSelection } from './checkinSelection';

/**
 * What a check-in takes and what follows from it. What each change adds is worked out once per read
 * (`checkinCandidatesOf`); selecting a row or typing the comment renders the view again, and goes over none of it.
 */
export function useCheckinSelection(allChanges: PendingChange[], choice: CheckinChoice): CheckinSelection {
  const candidates = useMemo(() => checkinCandidatesOf(allChanges), [allChanges]);
  const current = useMemo(() => currentChoice(choice, allChanges), [choice, allChanges]);
  return useMemo(() => checkinSelectionOf(candidates, current), [candidates, current]);
}
