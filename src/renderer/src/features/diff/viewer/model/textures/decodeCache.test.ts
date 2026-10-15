import { afterEach, describe, expect, it, vi } from 'vitest';
import { DecodeCache } from './decodeCache';

const EMPTIED_AFTER_MS = 1000;

function cacheOf(keptBytes: number) {
  const released: string[] = [];
  const cache = new DecodeCache<string>({ keptBytes, release: (value) => released.push(value), emptiedAfterMs: EMPTIED_AFTER_MS });
  return { cache, released };
}

describe('DecodeCache', () => {
  afterEach(() => vi.useRealTimers());

  it('lets the least recently used go past the bytes it keeps, freeing it', () => {
    const { cache, released } = cacheOf(10);
    cache.set('a', 'A', 4);
    cache.set('b', 'B', 4);
    expect(cache.get('a')).toBe('A');
    cache.set('c', 'C', 4);
    expect(cache.get('b')).toBeUndefined();
    expect([cache.get('a'), cache.get('c')]).toEqual(['A', 'C']);
    expect(released).toEqual(['B']);
  });

  it("lets go once a value's real size is told, and of what is deleted", () => {
    const { cache, released } = cacheOf(10);
    cache.set('a', 'A', 1);
    cache.set('b', 'B', 1);
    cache.set('c', 'C', 1);
    cache.resize('c', 9);
    expect([cache.get('a'), cache.get('b'), cache.get('c')]).toEqual([undefined, 'B', 'C']);
    cache.delete('b');
    expect(cache.size).toBe(1);
    expect(released).toEqual(['A', 'B']);
  });

  it('forgets what is deleted even while held: a decode that failed is tried again', () => {
    const { cache } = cacheOf(10);
    cache.hold(['a']);
    cache.set('a', 'failed', 1);
    cache.delete('a');
    expect(cache.get('a')).toBeUndefined();
  });

  it('never frees what a viewer holds, past the budget too, until the last hold on it ends', () => {
    const { cache, released } = cacheOf(4);
    const first = cache.hold(['a']);
    const second = cache.hold(['a']);
    cache.set('a', 'A', 4);
    cache.set('b', 'B', 4);
    expect(cache.get('a')).toBe('A');
    expect(released).toEqual(['B']);
    cache.set('c', 'C', 4);
    first();
    first();
    expect(released).toEqual(['B']);
    second();
    expect(released).toEqual(['B', 'A']);
    expect(cache.get('a')).toBeUndefined();
  });

  it('keeps within the budget what no one holds anymore, for the next model, and finds a held one past it again', () => {
    const { cache, released } = cacheOf(4);
    const release = cache.hold(['a', 'b']);
    cache.set('a', 'A', 4);
    cache.set('b', 'B', 4);
    expect(cache.has('a')).toBe(true);
    release();
    expect(released).toEqual(['A']);
    expect(cache.get('b')).toBe('B');
  });

  it('empties a while after the last hold ends, unless another comes first', () => {
    vi.useFakeTimers();
    const { cache, released } = cacheOf(100);
    cache.set('a', 'A', 1);
    cache.hold(['b'])();
    vi.advanceTimersByTime(EMPTIED_AFTER_MS - 1);
    const next = cache.hold(['b']);
    cache.set('b', 'B', 1);
    vi.advanceTimersByTime(EMPTIED_AFTER_MS);
    expect(released).toEqual([]);
    next();
    vi.advanceTimersByTime(EMPTIED_AFTER_MS);
    expect(released.sort()).toEqual(['A', 'B']);
    expect(cache.size).toBe(0);
  });
});
