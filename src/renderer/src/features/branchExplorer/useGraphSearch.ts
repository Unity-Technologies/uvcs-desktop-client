import { useDeferredValue, useState } from 'react';
import { graphSearchState, hitGoneTo, NO_SEARCH, type GraphSearchEvent } from './graphSearchState';
import type { GraphLayout } from './model/layoutGraph';
import { searchGraph, type SearchHit } from './model/searchGraph';

/**
 * The graph's search (`graphSearchState`): what is typed, what the graph looks for (`shown`, a key behind at most, so
 * the field follows every key at once), and the hit stepped to. Stepping and settling return the hit the graph goes to.
 */
export function useGraphSearch() {
  const [state, setState] = useState(NO_SEARCH);
  const shown = useDeferredValue(state.text);

  const apply = (event: GraphSearchEvent, hits: readonly SearchHit[]): SearchHit | null => {
    const next = graphSearchState(state, event);
    setState(next);
    return hitGoneTo(state, next, hits);
  };

  const change = (value: string): void => setState((current) => graphSearchState(current, { kind: 'typed', value }));

  /** Steps to the next (`1`) or previous (`-1`) hit and returns it; null when nothing matches. */
  const step = (direction: 1 | -1, layout: GraphLayout | null, shownHits: readonly SearchHit[]): SearchHit | null => {
    // Enter right after a key, before the graph caught up with it, steps through what is typed.
    const hits = shown === state.text ? shownHits : layout ? searchGraph(layout, state.text) : [];
    return apply({ kind: 'stepped', direction, hits }, hits);
  };

  /** The query typed last settled with these hits (null while the graph isn't laid out): its first hit, the first time. */
  const settle = (hits: readonly SearchHit[] | null): SearchHit | null => apply({ kind: 'settled', hits }, hits ?? []);

  return { text: state.text, shown, generation: state.generation, activeHitIndex: state.activeHitIndex, change, step, settle };
}

export type GraphSearch = ReturnType<typeof useGraphSearch>;
