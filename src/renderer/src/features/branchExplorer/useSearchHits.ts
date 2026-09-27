import { useMemo, useRef } from 'react';
import type { GraphLayout } from './model/layoutGraph';
import { searchGraph, type GraphSearchResult, type SearchHit } from './model/searchGraph';

const NO_HITS: SearchHit[] = [];

/**
 * The hits of the search in the layout. Each keystroke that narrows the search starts from the last one's hits,
 * so typing on in a long history looks at fewer changesets with every key instead of all of them.
 */
export function useSearchHits(layout: GraphLayout | null, search: string): SearchHit[] {
  const last = useRef<{ layout: GraphLayout; result: GraphSearchResult } | null>(null);
  return useMemo(() => {
    if (!layout) return NO_HITS;
    const previous = last.current?.layout === layout ? last.current.result : null;
    const hits = searchGraph(layout, search, previous);
    // Only a cache: a render that never shows still leaves a right answer for its query.
    last.current = { layout, result: { query: search, hits } };
    return hits;
  }, [layout, search]);
}
