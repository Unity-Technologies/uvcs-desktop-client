import { describe, expect, it } from 'vitest';
import { matchRanges, searchTerms } from './searchMarks';

describe('searchTerms', () => {
  it('splits the search into lowercased words', () => {
    expect(searchTerms('  Nitro  BOOST ')).toEqual(['nitro', 'boost']);
  });
});

describe('matchRanges', () => {
  it('finds every occurrence ignoring case', () => {
    expect(matchRanges('Boost the boost', ['boost'])).toEqual([0, 5, 10, 15]);
  });

  it('merges overlapping words and keeps them in order', () => {
    expect(matchRanges('/main/boost cooldown', ['cool', 'boost', 'oldown'])).toEqual([6, 11, 12, 20]);
  });

  it('finds nothing when no word shows', () => {
    expect(matchRanges('Drift physics', ['nitro'])).toEqual([]);
  });
});
