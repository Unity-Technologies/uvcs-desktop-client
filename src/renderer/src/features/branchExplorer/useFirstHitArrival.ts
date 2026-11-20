import { useEffect, useRef } from 'react';
import { useKeySettled } from '../../lib/useKeySettled';
import { FIRST_HIT_PAUSE_MS } from './graphSearchState';
import type { GraphLayout } from './model/layoutGraph';
import type { SearchHit } from './model/searchGraph';
import type { GraphSearch } from './useGraphSearch';

/**
 * Goes to the search's first hit by itself, as Next match would, once the query typed last has stayed put for
 * `FIRST_HIT_PAUSE_MS` and the graph has searched it (`graphSearchState`'s `settled`): the counter reads "1/N" and the
 * hit is selected and shown, without a key.
 */
export function useFirstHitArrival(search: GraphSearch, layout: GraphLayout | null, hits: readonly SearchHit[], goToHit: (hit: SearchHit) => void): void {
  // Keyed by the query's generation, not its text: going back to a query typed earlier waits its own pause.
  const settled = useKeySettled(String(search.generation), FIRST_HIT_PAUSE_MS);
  const caughtUp = search.shown === search.text;
  const searched = layout ? hits : null;
  const latest = useRef({ settle: search.settle, goToHit });
  latest.current = { settle: search.settle, goToHit };

  useEffect(() => {
    if (!settled || !caughtUp) return;
    const hit = latest.current.settle(searched);
    if (hit) latest.current.goToHit(hit);
  }, [settled, caughtUp, searched]);
}
