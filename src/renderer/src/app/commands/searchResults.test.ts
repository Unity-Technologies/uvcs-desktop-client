import { describe, expect, it } from 'vitest';
import { rankGroups, type SearchGroup, type SearchResult } from './searchResults';

function result(id: string, quality?: number): SearchResult {
  return { id, icon: () => null, label: id, quality, run: () => {} };
}

function ids(groups: SearchGroup[]): string[][] {
  return groups.map((group) => [group.heading, ...group.results.map((item) => item.id)]);
}

describe('rankGroups', () => {
  it('puts the group with the best match first and drops weak matches when there is a strong one', () => {
    const groups = [
      { heading: 'Files', results: [result('jar1', 0.2), result('jar2', 0.5)] },
      { heading: 'Branches', results: [result('near', 0.8), result('exact', 1), result('similar', 0.55)] },
      { heading: 'Changesets', results: [result('searchAll')] },
    ];
    expect(ids(rankGroups(groups))).toEqual([['Branches', 'exact', 'near'], ['Changesets', 'searchAll']]);
  });

  it('keeps weak matches when nothing matches well', () => {
    const groups = [{ heading: 'Files', results: [result('a', 0.2)] }];
    expect(ids(rankGroups(groups))).toEqual([['Files', 'a']]);
  });

  it('keeps the original order on ties', () => {
    const groups = [
      { heading: 'Files', results: [result('f', 0.8)] },
      { heading: 'Branches', results: [result('b', 0.8)] },
    ];
    expect(ids(rankGroups(groups)).map(([heading]) => heading)).toEqual(['Files', 'Branches']);
  });
});
