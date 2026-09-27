import type { Query, QueryFilters } from '@tanstack/react-query';
import { isRefreshable, queryClient } from '../queryClient';

const followUpScheduled = new WeakSet<Query>();

/**
 * Marks the matching queries stale (but immutable ones) and refetches the ones on screen, keeping their data meanwhile. Unlike
 * `invalidateQueries`, a fetch in flight is not cancelled and restarted (its `cm` command would keep running
 * anyway): it may predate the change, so one more fetch follows it, and further calls fold into that one.
 * Resolves once the refetches are done.
 */
export function refreshQueries(filters: QueryFilters): Promise<void> {
  const queries = queryClient.getQueryCache().findAll(filters).filter(isRefreshable);
  const idle = new Set(queries.filter((query) => query.state.fetchStatus !== 'fetching'));
  const fetching = queries.filter((query) => !idle.has(query));
  return Promise.all([refetch(idle), ...fetching.map(followUp)]).then(() => undefined);
}

/** One pass over the cache for them all: a pass per query (by its key) hashed every key in the cache for each one. */
function refetch(queries: ReadonlySet<Query>): Promise<void> {
  if (queries.size === 0) return Promise.resolve();
  return queryClient.invalidateQueries({ predicate: (query) => queries.has(query) }, { cancelRefetch: false });
}

function followUp(query: Query): Promise<void> {
  if (followUpScheduled.has(query)) return Promise.resolve();

  followUpScheduled.add(query);
  return new Promise((resolve) => {
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event.query !== query || query.state.fetchStatus === 'fetching') return;
      unsubscribe();
      followUpScheduled.delete(query);
      void refetch(new Set([query])).then(resolve);
    });
  });
}
