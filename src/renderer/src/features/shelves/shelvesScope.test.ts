import { describe, expect, it } from 'vitest';
import { shelvesEmptyMessage, shelvesFilterPlaceholder, shelvesListFilter, shelvesListNote, shelvesSearchFilter } from './shelvesScope';

const NOW = new Date('2026-09-27T12:00:00');

describe('shelvesListFilter', () => {
  it("reads the user's shelves by owner and date, everyone's by the same date alone", () => {
    expect(shelvesListFilter('mine', NOW)).toEqual({ owners: ['me'], sinceDate: '2026-06-28' });
    expect(shelvesListFilter('everyone', NOW)).toEqual({ sinceDate: '2026-06-28' });
  });
});

describe('shelvesSearchFilter', () => {
  it("searches the user's comments at any age, bounded by a limit", () => {
    expect(shelvesSearchFilter('mine', ' login ', NOW)).toEqual({ owners: ['me'], text: 'login', limit: 100 });
  });

  it("searches everyone's comments of the last year: cm can't sort shelves, and a limit alone would keep the oldest", () => {
    expect(shelvesSearchFilter('everyone', 'login', NOW)).toEqual({ text: 'login', sinceDate: '2025-09-27', limit: 100 });
  });

  it('asks nothing for fewer than three letters or a shelve number, which only matches what is listed', () => {
    expect(shelvesSearchFilter('everyone', 'lo', NOW)).toBeNull();
    expect(shelvesSearchFilter('everyone', 'sh:123', NOW)).toBeNull();
    expect(shelvesSearchFilter('mine', '4567', NOW)).toBeNull();
  });
});

describe('shelvesFilterPlaceholder', () => {
  it("says everyone's filter matches authors too", () => {
    expect(shelvesFilterPlaceholder('mine')).toBe('Filter your shelves');
    expect(shelvesFilterPlaceholder('everyone')).toBe('Filter by comment or author');
  });
});

describe('shelvesEmptyMessage', () => {
  it('tells an empty scope from a filter matching nothing', () => {
    expect(shelvesEmptyMessage('mine', false)).toBe('No shelves from the last 3 months.');
    expect(shelvesEmptyMessage('mine', true)).toBe('None of your shelves match.');
    expect(shelvesEmptyMessage('everyone', false)).toBe('No shelves from anyone in the last 3 months.');
    expect(shelvesEmptyMessage('everyone', true)).toBe('No shelves match.');
  });
});

describe('shelvesListNote', () => {
  it('says how far back the list goes', () => {
    expect(shelvesListNote({ shown: 12, total: 12, searchFull: false, filtering: false })).toBe('Last 3 months · search finds older ones');
  });

  it('says when it shows only the newest', () => {
    expect(shelvesListNote({ shown: 200, total: 1240, searchFull: false, filtering: false })).toBe('Newest 200 of 1,240 · filter to find others');
  });

  it('says when a search brought all it may', () => {
    expect(shelvesListNote({ shown: 100, total: 100, searchFull: true, filtering: true })).toBe('More may match · type more to narrow');
  });

  it('says nothing under a filter that found everything, nor under an empty list', () => {
    expect(shelvesListNote({ shown: 3, total: 3, searchFull: false, filtering: true })).toBeNull();
    expect(shelvesListNote({ shown: 0, total: 0, searchFull: false, filtering: false })).toBeNull();
  });
});
