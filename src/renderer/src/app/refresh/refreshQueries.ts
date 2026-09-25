import type { Query, QueryFilters } from '@tanstack/react-query';
import { queryClient } from '../queryClient';

const followUpScheduled = new WeakSet<Query>();

/**
 * Marks the matching queries stale and refetches the ones on screen, keeping their data meanwhile. Unlike
 * `invalidateQueries`, a fetch in flight is not cancelled and restarted (its `cm` command would keep running
 * anyway): it may predate the change, so one more fetch follows it, and further calls fold into that one.
 * Resolves once the refetches are done.
 */
export function refreshQueries(filters: QueryFilters): Promise<void> {
  return Promise.all(queryClient.getQueryCache().findAll(filters).map(refreshQuery)).then(() => undefined);
}

function refreshQuery(query: Query): Promise<void> {
  const refetch = () => queryClient.invalidateQueries({ queryKey: query.queryKey, exact: true }, { cancelRefetch: false });
  if (query.state.fetchStatus !== 'fetching') return refetch();
  if (followUpScheduled.has(query)) return Promise.resolve();

  followUpScheduled.add(query);
  return new Promise((resolve) => {
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event.query !== query || query.state.fetchStatus === 'fetching') return;
      unsubscribe();
      followUpScheduled.delete(query);
      void refetch().then(resolve);
    });
  });
}
