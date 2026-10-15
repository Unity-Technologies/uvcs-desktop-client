import { QueryClient, QueryObserver, type Query } from '@tanstack/react-query';
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

/** Data holding big objects, shared between queries where they are the same: `{ held: [[object, size]] }`. */
type Held = { held: [object, number][] };

function setUpBytes(maxBytes: number) {
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity, staleTime: Infinity } } });
  const heldBy = (query: Query) => new Map((query.state.data as Held | undefined)?.held ?? []);
  boundUnusedQueries(client.getQueryCache(), 100, (query) => query.meta?.immutable === true, { max: maxBytes, heldBy });
  const show = async (id: string, held: [object, number][]): Promise<() => void> => {
    const observer = new QueryObserver(client, { queryKey: [id], queryFn: (): Held => ({ held }), meta: { immutable: true } });
    const unsubscribe = observer.subscribe(() => {});
    await observer.refetch();
    return unsubscribe;
  };
  const fetch = (id: string, held: [object, number][]) => client.fetchQuery({ queryKey: [id], queryFn: (): Held => ({ held }), meta: { immutable: true } });
  const cached = (): unknown[] => client.getQueryCache().getAll().map((query) => query.queryKey[0]).sort();
  return { show, fetch, cached };
}

describe('boundUnusedQueries by bytes', () => {
  it('forgets the least recently shown once the unused ones hold more than the bound, counting data that came after', async () => {
    const { fetch, cached } = setUpBytes(100);
    await fetch('a', [[{}, 60]]);
    await fetch('b', [[{}, 30]]);
    expect(cached()).toEqual(['a', 'b']);
    await fetch('c', [[{}, 30]]);
    expect(cached()).toEqual(['b', 'c']);
  });

  it('counts an object several queries hold once, and frees it only with the last of them (a pair and its two files)', async () => {
    const { fetch, show, cached } = setUpBytes(100);
    const [left, right] = [{}, {}];
    await fetch('left', [[left, 40]]);
    await fetch('right', [[right, 40]]);
    (await show('pair', [[left, 40], [right, 40]]))();
    expect(cached()).toEqual(['left', 'pair', 'right']);
    await fetch('next', [[{}, 30]]);
    expect(cached()).toEqual(['next']);
  });

  it('counts for nothing what a query on screen holds: forgetting another would not free it', async () => {
    const { fetch, show, cached } = setUpBytes(100);
    const model = {};
    await fetch('model', [[model, 90]]);
    await show('diff', [[model, 90]]);
    await fetch('text', [[{}, 20]]);
    expect(cached()).toEqual(['diff', 'model', 'text']);
  });
});
