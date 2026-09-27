import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { boundUnusedQueries } from './boundUnusedQueries';

function setup(max: number) {
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity, staleTime: Infinity } } });
  boundUnusedQueries(client.getQueryCache(), max, (query) => query.meta?.immutable === true);
  /** Shows the query (as a mounted component would), then stops showing it. */
  const show = async (id: number, immutable = true): Promise<() => void> => {
    const observer = new QueryObserver(client, { queryKey: ['item', id], queryFn: () => id, meta: immutable ? { immutable } : undefined });
    const unsubscribe = observer.subscribe(() => {});
    await observer.refetch();
    return unsubscribe;
  };
  const cached = (): unknown[] => client.getQueryCache().getAll().map((query) => query.queryKey[1]);
  return { client, show, cached };
}

describe('boundUnusedQueries', () => {
  it('forgets the least recently shown once more than the bound are unused', async () => {
    const { show, cached } = setup(2);
    for (const id of [1, 2, 3]) (await show(id))();
    expect(cached()).toEqual([2, 3]);
  });

  it('never forgets a query on screen, and showing one again makes it the most recent', async () => {
    const { show, cached } = setup(2);
    const stillShown = await show(1);
    (await show(2))();
    (await show(3))();
    (await show(2))();
    (await show(4))();
    expect(cached().sort()).toEqual([1, 2, 4]);
    stillShown();
    expect(cached().sort()).toEqual([1, 4]);
  });

  it('counts queries only ever fetched, never shown', async () => {
    const { client, show, cached } = setup(2);
    for (const id of [1, 2]) await client.fetchQuery({ queryKey: ['item', id], queryFn: () => id, meta: { immutable: true } });
    (await show(3))();
    expect(cached()).toEqual([2, 3]);
  });

  it('leaves other queries alone', async () => {
    const { show, cached } = setup(1);
    (await show(1, false))();
    (await show(2))();
    (await show(3))();
    expect(cached().sort()).toEqual([1, 3]);
  });

  it('stays linear over a long session', async () => {
    const { show, cached } = setup(100);
    for (let id = 0; id < 5000; id++) (await show(id))();
    expect(cached()).toHaveLength(100);
  });
});
