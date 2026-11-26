import { QueryClient } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { settleTimeout } from '../lib/settleTimeout';
import { markReadsInFlight } from './markReadsInFlight';

/** A promise and the function that settles it, to hold a read in flight as long as a test needs. */
function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((settle) => (resolve = settle));
  return { promise, resolve };
}

const stops: (() => void)[] = [];
afterEach(() => {
  stops.splice(0).forEach((stop) => stop());
  vi.useRealTimers();
});

/** A client followed by the mark, on a root that counts how often the mark is written. */
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const values: DOMStringMap = {};
  let writes = 0;
  const dataset = new Proxy(values, {
    set: (target, name, value) => {
      writes += 1;
      return Reflect.set(target, name, value);
    },
  });
  const root = { dataset };
  stops.push(markReadsInFlight(client, root));
  return { client, root, writes: () => writes };
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

  it('marks the page while a selection waits to settle before it reads, and clears it once it settled', () => {
    vi.useFakeTimers();
    const { root } = setup();
    settleTimeout(() => {}, 300);
    expect(root.dataset.reading).toBe('true');
    vi.advanceTimersByTime(300);
    expect(root.dataset.reading).toBe('false');
  });

  it('writes the mark only when it changes', async () => {
    const { client, writes } = setup();
    const answer = deferred<number>();
    const reads = [client.fetchQuery({ queryKey: ['a'], queryFn: () => answer.promise }), client.fetchQuery({ queryKey: ['b'], queryFn: () => answer.promise })];
    answer.resolve(1);
    await Promise.all(reads);
    expect(writes()).toBe(3);
  });
});
