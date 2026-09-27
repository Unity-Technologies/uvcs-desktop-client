import { describe, expect, it } from 'vitest';
import { matchesAllWords, matchesWordFilter, wordMatchQuality } from './matchesAllWords';

describe('matchesAllWords', () => {
  it('needs every word, in any order and case', () => {
    expect(matchesAllWords('Fix merge crash on Windows', 'windows merge')).toBe(true);
    expect(matchesAllWords('Fix merge crash on Windows', 'merge linux')).toBe(false);
  });

  it('finds a word anywhere inside a name, digits too', () => {
    expect(matchesAllWords('/main/scm1008742', '100874')).toBe(true);
    expect(matchesAllWords('/main/SCM1008742', 'Main/scm 742')).toBe(true);
    expect(matchesAllWords('/main/scm1008874', '100874')).toBe(false);
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

describe('matchesWordFilter', () => {
  it('finds each word in one of the texts, never across two', () => {
    expect(matchesWordFilter(['Fix login', 'Jane Doe'], 'jane login')).toBe(true);
    expect(matchesWordFilter(['Fix login', 'Jane Doe'], 'login jane doe')).toBe(true);
    expect(matchesWordFilter(['Fix login', 'Jane Doe'], 'loginjane')).toBe(false);
    expect(matchesWordFilter(['Fix login', 'Jane Doe'], 'logout')).toBe(false);
  });

  it('keeps every row for a blank query', () => {
    expect(matchesWordFilter(['anything'], '  ')).toBe(true);
    expect(matchesWordFilter([], '')).toBe(true);
  });
});
