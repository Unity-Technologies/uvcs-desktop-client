import { describe, expect, it } from 'vitest';
import { matchesAllWords, wordMatchQuality } from './matchesAllWords';

describe('matchesAllWords', () => {
  it('needs every word, in any order and case', () => {
    expect(matchesAllWords('Fix merge crash on Windows', 'windows merge')).toBe(true);
    expect(matchesAllWords('Fix merge crash on Windows', 'merge linux')).toBe(false);
  });

  it('matches nothing for a blank query', () => {
    expect(matchesAllWords('anything', '   ')).toBe(false);
  });
});

describe('wordMatchQuality', () => {
  it('prefers the whole text, then its start, then the query in one piece', () => {
    expect(wordMatchQuality('Bamboo plugin', 'bamboo plugin')).toBe(1);
    expect(wordMatchQuality('Bamboo plugin part 1', 'bamboo plugin')).toBe(0.9);
    expect(wordMatchQuality('Fix the bamboo plugin', 'bamboo plugin')).toBe(0.8);
    expect(wordMatchQuality('Plugin for bamboo', 'bamboo plugin')).toBe(0.6);
    expect(wordMatchQuality('Unrelated', 'bamboo')).toBe(0);
  });
});
