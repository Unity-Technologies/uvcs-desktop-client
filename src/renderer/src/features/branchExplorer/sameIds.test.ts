import { describe, expect, it } from 'vitest';
import { sameIds } from './sameIds';

describe('sameIds', () => {
  it('is the same list for the same ids in the same order', () => {
    expect(sameIds([1, 2], [1, 2])).toBe(true);
    expect(sameIds([], [])).toBe(true);
  });

  it('differs by an id, a length or the order', () => {
    expect(sameIds([1, 2], [1, 3])).toBe(false);
    expect(sameIds([1, 2], [1])).toBe(false);
    expect(sameIds([1, 2], [2, 1])).toBe(false);
  });
});
