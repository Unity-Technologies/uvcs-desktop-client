import type { Query, QueryCache } from '@tanstack/react-query';

/**
 * Keeps at most `max` of the matching queries once nothing shows them, forgetting the least recently shown first.
 * Immutable results (what a changeset changed, revisions) are kept for the session or an hour, one per object opened:
 * without a bound they would pile up over a long session. Returns the unsubscribe.
 */
export function boundUnusedQueries(cache: QueryCache, max: number, matches: (query: Query) => boolean): () => void {
  // In the order they were last shown, oldest first.
  const unused = new Set<Query>();

  return cache.subscribe((event) => {
    const { query } = event;
    if (event.type === 'removed' || event.type === 'observerAdded') {
      unused.delete(query);
      return;
    }
    // Added covers queries only ever read through `fetchQuery` (a revision's text read for its diff).
    if ((event.type !== 'observerRemoved' && event.type !== 'added') || query.getObserversCount() > 0 || !matches(query)) return;

    unused.delete(query);
    unused.add(query);
    for (const oldest of unused) {
      if (unused.size <= max) break;
      unused.delete(oldest);
      cache.remove(oldest);
    }
  });
}
