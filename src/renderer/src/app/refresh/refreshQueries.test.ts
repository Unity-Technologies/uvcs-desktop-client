import { QueryObserver } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { countCalls } from '@shared/testing/countCalls';
import { IMMUTABLE_QUERY, queryClient } from '../queryClient';
import { refreshQueries } from './refreshQueries';

vi.mock('./trackWindowFocus', () => ({ trackWindowFocus: () => {} }));

/** A query on screen (observed) whose fetches are counted, and resolve when told to. */
function shownQuery(key: string, meta?: Record<string, unknown>) {
  const fetched = { count: 0, finish: () => {}, started: () => {} };
  const observer = new QueryObserver(queryClient, {
    queryKey: ['test', key],
    queryFn: () => {
      fetched.count++;
      fetched.started();
      return new Promise<number>((resolve) => (fetched.finish = () => resolve(fetched.count)));
    },
    staleTime: Infinity,
    meta,
  });
  const unsubscribe = observer.subscribe(() => {});
  /** Resolves when the query starts its next fetch. */
  const nextFetch = (): Promise<void> => new Promise((resolve) => (fetched.started = resolve));
  return { fetched, nextFetch, unsubscribe };
}

/** Resolves once no query is fetching: the fetches told to finish are done. */
function nothingFetching(): Promise<void> {
  return new Promise((resolve) => {
    const settleIfIdle = (): void => {
      if (queryClient.isFetching() > 0) return;
      unsubscribe();
      resolve();
    };
    const unsubscribe = queryClient.getQueryCache().subscribe(settleIfIdle);
    settleIfIdle();
  });
}

afterEach(() => queryClient.clear());

describe('refreshQueries', () => {
  it('refetches what is idle once, and follows a fetch in flight with one more', async () => {
    const idle = shownQuery('idle');
    idle.fetched.finish();
    await nothingFetching();
    expect(queryClient.getQueryData(['test', 'idle'])).toBe(1);
    const busy = shownQuery('busy');

    const refreshed = refreshQueries({ queryKey: ['test'] });
    void refreshQueries({ queryKey: ['test', 'busy'] });
    expect(idle.fetched.count).toBe(2);
    expect(busy.fetched.count).toBe(1);

    const followedUp = busy.nextFetch();
    idle.fetched.finish();
    busy.fetched.finish();
    await followedUp;
    expect(busy.fetched.count).toBe(2);
    busy.fetched.finish();
    await refreshed;
    expect(queryClient.getQueryData(['test', 'busy'])).toBe(2);
    idle.unsubscribe();
    busy.unsubscribe();
  });

  it('leaves immutable results alone', async () => {
    const changesetFiles = shownQuery('changesetFiles', IMMUTABLE_QUERY);
    changesetFiles.fetched.finish();
    await nothingFetching();

    await refreshQueries({ queryKey: ['test'] });

    expect(changesetFiles.fetched.count).toBe(1);
    changesetFiles.unsubscribe();
  });

  it('refreshes thousands of queries on screen without a pass over the cache for each', async () => {
    /** The passes over the cache a refresh of `count` queries on screen makes. */
    const passesRefreshing = async (count: number): Promise<number> => {
      const shown = Array.from({ length: count }, (_, index) => shownQuery(`folder${index}`));
      shown.forEach((query) => query.fetched.finish());
      await nothingFetching();

      const { result: refreshed, calls: passes } = countCalls(queryClient.getQueryCache(), 'findAll', () => refreshQueries({ queryKey: ['test'] }));
      expect(shown.every((query) => query.fetched.count === 2)).toBe(true);
      shown.forEach((query) => query.fetched.finish());
      await refreshed;
      shown.forEach((query) => query.unsubscribe());
      queryClient.clear();
      return passes;
    };

    // A pass per query hashed every key in the cache for each: 3,000 queries took seconds.
    expect(await passesRefreshing(3000)).toBe(await passesRefreshing(3));
  });
});
