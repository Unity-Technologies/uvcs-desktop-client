import { describe, expect, it } from 'vitest';
import { adjacentKey } from './fileSteps';

describe('adjacentKey', () => {
  const keys = ['a', 'b', 'c'];

  it('finds the file after or before the one shown', () => {
    expect(adjacentKey(keys, 'b', 1)).toBe('c');
    expect(adjacentKey(keys, 'b', -1)).toBe('a');
  });

  it('stops at the ends, and without a file shown among them', () => {
    expect(adjacentKey(keys, 'c', 1)).toBeNull();
    expect(adjacentKey(keys, 'a', -1)).toBeNull();
    expect(adjacentKey(keys, 'x', 1)).toBeNull();
    expect(adjacentKey(keys, null, 1)).toBeNull();
  });
});
