import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { markReadsInFlight } from './markReadsInFlight';

/** A promise and the function that settles it, to hold a read in flight as long as a test needs. */
function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((settle) => (resolve = settle));
  return { promise, resolve };
}

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const root = { dataset: {} as DOMStringMap };
  markReadsInFlight(client, root);
  return { client, root };
}

describe('markReadsInFlight', () => {
  it('says nothing is in flight before anything is read', () => {
    expect(setup().root.dataset.reading).toBe('false');
  });

  it('marks the page while a read is in flight, and clears it once the read answers', async () => {
    const { client, root } = setup();
    const answer = deferred<number>();
    const read = client.fetchQuery({ queryKey: ['branches'], queryFn: () => answer.promise });
    expect(root.dataset.reading).toBe('true');
    answer.resolve(3);
    await read;
    expect(root.dataset.reading).toBe('false');
  });

  it('clears it once a failed read ends too', async () => {
    const { client, root } = setup();
    await expect(client.fetchQuery({ queryKey: ['branches'], queryFn: () => Promise.reject(new Error('offline')) })).rejects.toThrow('offline');
    expect(root.dataset.reading).toBe('false');
  });

  it('stays marked until the last of several reads answers', async () => {
    const { client, root } = setup();
    const first = deferred<number>();
    const second = deferred<number>();
    const reads = [client.fetchQuery({ queryKey: ['a'], queryFn: () => first.promise }), client.fetchQuery({ queryKey: ['b'], queryFn: () => second.promise })];
    first.resolve(1);
    await reads[0];
    expect(root.dataset.reading).toBe('true');
    second.resolve(2);
    await reads[1];
    expect(root.dataset.reading).toBe('false');
  });

  it('marks the page while a change is in flight', async () => {
    const { client, root } = setup();
    const done = deferred<void>();
    const change = client.getMutationCache().build(client, { mutationFn: () => done.promise }).execute(undefined);
    expect(root.dataset.reading).toBe('true');
    done.resolve();
    await change;
    expect(root.dataset.reading).toBe('false');
  });
});
