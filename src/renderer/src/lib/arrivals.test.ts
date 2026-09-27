import { describe, expect, it } from 'vitest';
import { Arrivals } from './arrivals';

describe('Arrivals', () => {
  it('treats the first keys as the loaded list, not arrivals', () => {
    expect(new Arrivals(400).update(['a', 'b'], 0)).toEqual(new Set());
  });

  it('reports keys that show up later while their window lasts', () => {
    const arrivals = new Arrivals(400);
    arrivals.update(['a'], 0);
    expect(arrivals.update(['a', 'b'], 1000)).toEqual(new Set(['b']));
    expect(arrivals.update(['a', 'b'], 1300)).toEqual(new Set(['b']));
    expect(arrivals.update(['a', 'b'], 1400)).toEqual(new Set());
  });

  it('counts keys arriving into an empty list', () => {
    const arrivals = new Arrivals(400);
    arrivals.update([], 0);
    expect(arrivals.update(['a'], 10)).toEqual(new Set(['a']));
  });

  it('does not replay a key that leaves and comes back', () => {
    const arrivals = new Arrivals(400);
    arrivals.update(['a'], 0);
    arrivals.update([], 100);
    expect(arrivals.update(['a'], 2000)).toEqual(new Set());
  });

  it('lets arrivals expire when given the same keys again', () => {
    const arrivals = new Arrivals(400);
    arrivals.update(['a'], 0);
    const keys = ['a', 'b'];
    expect(arrivals.update(keys, 1000)).toEqual(new Set(['b']));
    expect(arrivals.update(keys, 1300)).toEqual(new Set(['b']));
    expect(arrivals.update(keys, 1400)).toEqual(new Set());
  });

  it('goes through the keys again only when they change', () => {
    const arrivals = new Arrivals(400);
    let reads = 0;
    const keys = new Proxy(Array.from({ length: 100_000 }, (_, index) => `k${index}`), {
      get: (target, property, receiver) => {
        if (property === Symbol.iterator) reads++;
        return Reflect.get(target, property, receiver);
      },
    });
    for (let now = 0; now < 50; now++) arrivals.update(keys, now);
    expect(reads).toBe(1);
  });
});
