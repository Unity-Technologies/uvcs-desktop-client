import { useEffect, useRef } from 'react';
import { useKeySettled } from '../../lib/useKeySettled';
import { FIRST_HIT_PAUSE_MS, goesToFirstHit } from './searchArrival';
import type { GraphSearchState } from './useGraphSearch';

/**
 * Goes to the search's first hit by itself, as the next match button would, once the typed query has stayed put and
 * found something (`goesToFirstHit`): the counter reads "1/N" and the hit is selected and shown, without a key.
 */
export function useFirstHitArrival(search: GraphSearchState, hitCount: number, goToFirstHit: () => void): void {
  const typedSettled = useKeySettled(search.text, FIRST_HIT_PAUSE_MS);
  const goes = goesToFirstHit(search.awaitingFirstHit, { typedSettled, searchCaughtUp: search.shown === search.text, hitCount });
  const latest = useRef(goToFirstHit);
  latest.current = goToFirstHit;

  useEffect(() => {
    // Stepping clears `awaitingFirstHit`, so this goes once per query typed.
    if (goes) latest.current();
  }, [goes]);
}
