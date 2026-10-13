import { describe, expect, it } from 'vitest';
import { DecodeCache } from './decodeCache';

describe('DecodeCache', () => {
  it('lets the least recently used go past the bytes it keeps', () => {
    const cache = new DecodeCache<string>(10);
    cache.set('a', 'A', 4);
    cache.set('b', 'B', 4);
    expect(cache.get('a')).toBe('A');
    cache.set('c', 'C', 4);
    expect(cache.get('b')).toBeUndefined();
    expect([cache.get('a'), cache.get('c')]).toEqual(['A', 'C']);
  });

  it("lets go once a value's real size is told, and of what is deleted", () => {
    const cache = new DecodeCache<string>(10);
    cache.set('a', 'A', 1);
    cache.set('b', 'B', 1);
    cache.set('c', 'C', 1);
    cache.resize('c', 9);
    expect([cache.get('a'), cache.get('b'), cache.get('c')]).toEqual([undefined, 'B', 'C']);
    cache.delete('b');
    expect(cache.size).toBe(1);
  });
});
