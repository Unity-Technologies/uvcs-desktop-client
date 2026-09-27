import { describe, expect, it } from 'vitest';
import { collapseGroups, COLLAPSED_ROWS, moreLabel, rankGroups, type SearchGroup, type SearchResult } from './searchResults';

function result(id: string, quality?: number): SearchResult {
  return { id, icon: () => null, label: id, quality, run: () => {} };
}

function ids(groups: SearchGroup[]): string[][] {
  return groups.map((group) => [group.heading, ...group.results.map((item) => item.id)]);
}

describe('rankGroups', () => {
  it('puts the group with the best match first and drops weak matches when there is a strong one', () => {
    const groups: SearchGroup[] = [
      { section: 'files', heading: 'Files', results: [result('jar1', 0.2), result('jar2', 0.5)] },
      { section: 'branches', heading: 'Branches', results: [result('near', 0.8), result('exact', 1), result('similar', 0.55)] },
      { section: 'changesets', heading: 'Changesets', results: [result('searchAll')] },
    ];
    expect(ids(rankGroups(groups))).toEqual([['Branches', 'exact', 'near'], ['Changesets', 'searchAll']]);
  });

  it('keeps weak matches when nothing matches well', () => {
    const groups: SearchGroup[] = [{ section: 'files', heading: 'Files', results: [result('a', 0.2)] }];
    expect(ids(rankGroups(groups))).toEqual([['Files', 'a']]);
  });

  it('keeps the original order on ties', () => {
    const groups: SearchGroup[] = [
      { section: 'files', heading: 'Files', results: [result('f', 0.8)] },
      { section: 'branches', heading: 'Branches', results: [result('b', 0.8)] },
    ];
    expect(ids(rankGroups(groups)).map(([heading]) => heading)).toEqual(['Files', 'Branches']);
  });
});

describe('collapseGroups', () => {
  const many = (prefix: string, count: number) => Array.from({ length: count }, (_, index) => result(`${prefix}${index}`));
  const groups: SearchGroup[] = [
    { section: 'commands', heading: 'Commands', results: many('c', 12) },
    { section: 'branches', heading: 'Branches', results: many('b', 3) },
  ];

  it('caps each section and counts what it holds back', () => {
    const shown = collapseGroups(groups, new Set());
    expect(shown.map((group) => [group.results.length, group.more])).toEqual([
      [COLLAPSED_ROWS, 12 - COLLAPSED_ROWS],
      [3, 0],
    ]);
  });

  it('keeps pinned results visible after the capped ones', () => {
    const pinned = { ...result('searchAll'), pinned: true };
    const [shown] = collapseGroups([{ section: 'changesets', heading: 'Changesets', results: [pinned, ...many('cs', 8)] }], new Set());
    expect(shown!.results.map((item) => item.id)).toEqual(['cs0', 'cs1', 'cs2', 'cs3', 'cs4', 'searchAll']);
    expect(shown!.more).toBe(3);
  });

  it('shows expanded sections in full', () => {
    expect(collapseGroups(groups, new Set(['commands']))[0]).toMatchObject({ more: 0, results: groups[0]!.results });
    expect(collapseGroups(groups, 'all').every((group) => group.more === 0)).toBe(true);
  });
});

describe('moreLabel', () => {
  it('counts what a collapsed section holds back in its own words, one or many', () => {
    expect(moreLabel({ heading: 'Branches', more: 1 })).toBe('1 more branch');
    expect(moreLabel({ heading: 'Branches', more: 2 })).toBe('2 more branches');
    expect(moreLabel({ heading: 'Commands', more: 1 })).toBe('1 more command');
    expect(moreLabel({ heading: 'Pending changes', more: 1 })).toBe('1 more pending change');
    expect(moreLabel({ heading: 'Shelves', more: 1 })).toBe('1 more shelve');
    expect(moreLabel({ heading: 'Code reviews', more: 29 })).toBe('29 more code reviews');
  });
});
