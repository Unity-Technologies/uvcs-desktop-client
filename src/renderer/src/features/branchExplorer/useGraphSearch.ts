import { useDeferredValue, useState } from 'react';
import type { GraphLayout } from './model/layoutGraph';
import { searchGraph, steppedHitIndex, type SearchHit } from './model/searchGraph';

/**
 * The graph's search: what is typed, what the graph looks for (`shown`, a key behind at most, so the field follows
 * every key at once), and the hit Enter stepped to (-1 until the user steps).
 */
export function useGraphSearch() {
  const [text, setText] = useState('');
  const shown = useDeferredValue(text);
  const [activeHitIndex, setActiveHitIndex] = useState(-1);

  const change = (value: string): void => {
    setText(value);
    setActiveHitIndex(-1);
  };

  /** Steps to the next (`1`) or previous (`-1`) hit and returns it; null when nothing matches. */
  const step = (direction: 1 | -1, layout: GraphLayout | null, shownHits: readonly SearchHit[]): SearchHit | null => {
    // Enter right after a key, before the graph caught up with it, steps through what is typed.
    const hits = shown === text ? shownHits : layout ? searchGraph(layout, text) : [];
    if (hits.length === 0) return null;
    const next = steppedHitIndex(activeHitIndex, direction, hits, text);
    setActiveHitIndex(next);
    return hits[next]!;
  };

  return { text, shown, activeHitIndex, change, step };
}
