import { QueryObserver } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { queryClient } from '../queryClient';
import { refreshQueries } from './refreshQueries';

vi.mock('./trackWindowFocus', () => ({ trackWindowFocus: () => {} }));

/** A query on screen (observed) whose fetches are counted, and resolve when told to. */
function shownQuery(key: string) {
  const fetched = { count: 0, finish: () => {} };
  const observer = new QueryObserver(queryClient, {
    queryKey: ['test', key],
    queryFn: () => {
      fetched.count++;
      return new Promise<number>((resolve) => (fetched.finish = () => resolve(fetched.count)));
    },
    staleTime: Infinity,
  });
  const unsubscribe = observer.subscribe(() => {});
  return { fetched, unsubscribe };
}

afterEach(() => queryClient.clear());

describe('refreshQueries', () => {
  it('refetches what is idle once, and follows a fetch in flight with one more', async () => {
    const idle = shownQuery('idle');
    idle.fetched.finish();
    await vi.waitFor(() => expect(queryClient.getQueryData(['test', 'idle'])).toBe(1));
    const busy = shownQuery('busy');

    const refreshed = refreshQueries({ queryKey: ['test'] });
    void refreshQueries({ queryKey: ['test', 'busy'] });
    expect(idle.fetched.count).toBe(2);
    expect(busy.fetched.count).toBe(1);

    idle.fetched.finish();
    busy.fetched.finish();
    await vi.waitFor(() => expect(busy.fetched.count).toBe(2));
    busy.fetched.finish();
    await refreshed;
    expect(queryClient.getQueryData(['test', 'busy'])).toBe(2);
    idle.unsubscribe();
    busy.unsubscribe();
  });

  it('refreshes thousands of queries on screen without a pass over the cache for each', async () => {
    const shown = Array.from({ length: 3000 }, (_, index) => shownQuery(`folder${index}`));
    shown.forEach((query) => query.fetched.finish());
    await vi.waitFor(() => expect(queryClient.isFetching()).toBe(0));

    const started = performance.now();
    const refreshed = refreshQueries({ queryKey: ['test'] });
    expect(performance.now() - started).toBeLessThan(1000);
    expect(shown.every((query) => query.fetched.count === 2)).toBe(true);
    shown.forEach((query) => query.fetched.finish());
    await refreshed;
    shown.forEach((query) => query.unsubscribe());
  });
});
