import type { Query, QueryCache } from '@tanstack/react-query';

/** A bound on the bytes unused queries hold, besides their number. */
export interface UnusedBytesBound {
  max: number;
  /**
   * The big objects a query's data holds (a file's content, its bytes), each with its size in bytes. An object several
   * queries hold counts once, and one a query on screen holds counts for nothing: forgetting others won't free it.
   */
  heldBy: (query: Query) => ReadonlyMap<object, number>;
}

/**
 * Keeps at most `max` of the matching queries once nothing shows them, and at most `bytes.max` bytes of what they
 * hold, forgetting the least recently shown first. Immutable results (what a changeset changed, revisions) are kept
 * for the session or an hour, one per object opened: without a bound they would pile up over a long session, and by
 * number alone a hundred 3D models' bytes would. Returns the unsubscribe.
 */
export function boundUnusedQueries(cache: QueryCache, max: number, matches: (query: Query) => boolean, bytes?: UnusedBytesBound): () => void {
  // In the order they were last shown, oldest first.
  const unused = new Set<Query>();

  const forgetPastBounds = (): void => {
    const held = bytes ? new UnusedBytes(cache, unused, bytes.heldBy) : null;
    const maxBytes = bytes?.max ?? Infinity;
    for (const oldest of unused) {
      if (unused.size <= max && (held?.total ?? 0) <= maxBytes) break;
      unused.delete(oldest);
      held?.forget(oldest);
      cache.remove(oldest);
    }
  };

  return cache.subscribe((event) => {
    const { query } = event;
    if (event.type === 'removed' || event.type === 'observerAdded') {
      unused.delete(query);
      return;
    }
    // An unused query's data came in (a read only ever fetched): it may hold more than the bound.
    if (event.type === 'updated' && event.action.type === 'success' && bytes && unused.has(query)) return forgetPastBounds();
    // Added covers queries only ever read through `fetchQuery` (a revision's text read for its diff).
    if ((event.type !== 'observerRemoved' && event.type !== 'added') || query.getObserversCount() > 0 || !matches(query)) return;

    unused.delete(query);
    unused.add(query);
    forgetPastBounds();
  });
}

/** The bytes only unused queries hold, each object once, as queries are forgotten. */
class UnusedBytes {
  total = 0;
  private readonly holders = new Map<object, number>();
  private readonly onScreen = new Set<object>();
  private readonly heldOf = new Map<Query, ReadonlyMap<object, number>>();

  constructor(cache: QueryCache, unused: ReadonlySet<Query>, heldBy: (query: Query) => ReadonlyMap<object, number>) {
    for (const query of cache.getAll()) if (query.getObserversCount() > 0) for (const object of heldBy(query).keys()) this.onScreen.add(object);
    for (const query of unused) {
      const held = heldBy(query);
      this.heldOf.set(query, held);
      for (const [object, size] of held) {
        if (this.onScreen.has(object)) continue;
        const holders = this.holders.get(object) ?? 0;
        if (holders === 0) this.total += size;
        this.holders.set(object, holders + 1);
      }
    }
  }

  forget(query: Query): void {
    for (const [object, size] of this.heldOf.get(query) ?? []) {
      if (this.onScreen.has(object)) continue;
      const holders = this.holders.get(object)! - 1;
      this.holders.set(object, holders);
      if (holders === 0) this.total -= size;
    }
  }
}
