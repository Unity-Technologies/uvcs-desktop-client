import { describe, expect, it } from 'vitest';
import { branchIdCondition, chunk } from './branchNamesById';

describe('branchNamesById helpers', () => {
  it('splits ids into bounded batches', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('builds one condition per batch', () => {
    expect(branchIdCondition([7, 9])).toBe('where id = 7 or id = 9');
  });
});
