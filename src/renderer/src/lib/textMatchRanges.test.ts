import { describe, expect, it } from 'vitest';
import { positionRanges, wordMatchRanges } from './textMatchRanges';

describe('wordMatchRanges', () => {
  it('finds every occurrence of every word, ignoring case', () => {
    expect(wordMatchRanges('Merge the merge bot', 'merge bot')).toEqual([
      [0, 5],
      [10, 15],
      [16, 19],
    ]);
  });

  it('merges overlapping matches', () => {
    expect(wordMatchRanges('abcd', 'abc bcd')).toEqual([[0, 4]]);
  });

  it('matches nothing for a blank query', () => {
    expect(wordMatchRanges('text', '  ')).toEqual([]);
  });
});

describe('positionRanges', () => {
  it('joins consecutive positions', () => {
    expect(positionRanges([0, 1, 2, 5, 7, 8])).toEqual([
      [0, 3],
      [5, 6],
      [7, 9],
    ]);
  });
});
