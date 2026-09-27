import { describe, expect, it } from 'vitest';
import { firstMatch, searchedSections } from './searchedSections';

const recent = { id: 'recent', entries: [] as string[] };
const all = { id: 'all', entries: ['game', 'tools'] };

describe('searchedSections', () => {
  it('shows every section without a search, empty ones too', () => {
    expect(searchedSections([recent, all], '')).toEqual([recent, all]);
    expect(searchedSections([recent, all], '  ')).toEqual([recent, all]);
  });

  it('leaves out the sections without matches during a search', () => {
    expect(searchedSections([recent, all], 'ga')).toEqual([all]);
  });

  it('shows no section at all when the search finds nothing, so the list says it once', () => {
    expect(searchedSections([recent, { id: 'all', entries: [] }], 'zzz')).toEqual([]);
  });
});

describe('firstMatch', () => {
  it('is the first entry in the order the list shows them', () => {
    expect(firstMatch([recent, all])).toBe('game');
    expect(firstMatch([{ entries: ['art'] }, all])).toBe('art');
  });

  it('is nothing when no section has entries', () => {
    expect(firstMatch([recent])).toBeUndefined();
  });
});
