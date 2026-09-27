import { describe, expect, it } from 'vitest';
import { largeHistory } from './graphFixtures';
import { layoutGraph } from './layoutGraph';
import { searchGraph, type GraphSearchResult } from './searchGraph';
import { changesetMatcher, narrows } from './searchWords';

describe('changesetMatcher', () => {
  const matches = (query: string, comment: string, owner = 'jane@example.com') => changesetMatcher(query.toLowerCase().split(' '))(comment, owner);

  it('finds each word in the comment or the owner, in any case', () => {
    expect(matches('fix jane', 'Fix the crash')).toBe(true);
    expect(matches('crash', 'Fix the CRASH')).toBe(true);
    expect(matches('fix bob', 'Fix the crash')).toBe(false);
  });
});

describe('narrows', () => {
  it('holds while typing on, adding letters or words', () => {
    expect(narrows('fi', 'fix')).toBe(true);
    expect(narrows('fix', 'fix cr')).toBe(true);
    expect(narrows('fix cr', 'crash fix')).toBe(true);
  });

  it('never holds after deleting or changing what was typed', () => {
    expect(narrows('fix', 'fi')).toBe(false);
    expect(narrows('fix cr', 'fix')).toBe(false);
    expect(narrows('fix', 'fax')).toBe(false);
    expect(narrows('', 'fix')).toBe(false);
  });
});

describe('searchGraph typing on', () => {
  it('finds from the last hits exactly what a full search finds, numbers included', () => {
    const layout = layoutGraph(largeHistory(5_000, 1_000));
    for (const typed of ['change 42 dev2', 'cs:42 task', 'Task1 main', 'v2000 x']) {
      let previous: GraphSearchResult | null = null;
      for (let length = 1; length <= typed.length; length++) {
        const query = typed.slice(0, length);
        const hits = searchGraph(layout, query, previous);
        expect(hits).toEqual(searchGraph(layout, query));
        previous = { query, hits };
      }
    }
  });
});
