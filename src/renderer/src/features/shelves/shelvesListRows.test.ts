import { describe, expect, it } from 'vitest';
import type { Shelve } from '@shared/domain/shelve';
import { shelvesListRows } from './shelvesListRows';

const NOW = Date.parse('2026-09-27T12:00:00Z');

const shelve = (id: number, comment = `Shelve ${id}`, owner = 'me'): Shelve => ({
  id,
  guid: `g${id}`,
  comment,
  owner,
  date: '2026-09-27T10:00:00Z',
  parentChangeset: 4,
  repository: 'game@local',
});

/** Shelves numbered `count` down to 1, newest first, as `cm find shelve` lists them after sorting. */
const newestFirst = (count: number, owner = 'me') => Array.from({ length: count }, (_, index) => shelve(count - index, `Shelve ${count - index}`, owner));

function rows(input: Partial<Parameters<typeof shelvesListRows>[0]>) {
  return shelvesListRows({ scope: 'mine', listed: [], found: undefined, filter: '', records: [], me: 'me', now: NOW, ...input });
}

describe('shelvesListRows', () => {
  it('shows every shelve of a short list, and says how far back it goes', () => {
    const { shown, note } = rows({ listed: newestFirst(3) });
    expect(shown.map((row) => row.shelve.id)).toEqual([3, 2, 1]);
    expect(note).toBe('Last 3 months · search finds older ones');
  });

  it('renders only the newest 200, and says so', () => {
    const { shown, note } = rows({ scope: 'everyone', listed: newestFirst(340, 'jane') });
    expect(shown).toHaveLength(200);
    expect(shown[0]!.shelve.id).toBe(340);
    expect(shown.at(-1)!.shelve.id).toBe(141);
    expect(note).toBe('Newest 200 of 340 · filter to find others');
  });

  it('adds the older shelves the search found while filtering, newest first, each once', () => {
    const { shown, note } = rows({ listed: [shelve(30, 'Login form'), shelve(20, 'Other')], found: [shelve(30, 'Login form'), shelve(4, 'Old login')], filter: 'login' });
    expect(shown.map((row) => row.shelve.id)).toEqual([30, 4]);
    expect(note).toBeNull();
  });

  it('keeps to the list while the search has not answered, or when the filter is gone', () => {
    expect(rows({ listed: [shelve(30, 'Login')], filter: 'login' }).shown.map((row) => row.shelve.id)).toEqual([30]);
    expect(rows({ listed: [shelve(30, 'Login')], found: [shelve(4, 'Old login')], filter: ' ' }).shown.map((row) => row.shelve.id)).toEqual([30]);
  });

  it('says more may match when the search brought all it may', () => {
    const found = Array.from({ length: 100 }, (_, index) => shelve(index + 1, 'login'));
    expect(rows({ listed: [], found, filter: 'login' }).note).toBe('More may match · type more to narrow');
  });

  it("matches everyone's shelves by author, and tells the user's own apart", () => {
    const listed = [shelve(3, 'Spike', 'jane.doe@unity3d.com'), shelve(2, 'Mine too', 'Me')];
    expect(rows({ scope: 'everyone', listed, filter: 'jane' }).shown.map((row) => row.shelve.id)).toEqual([3]);
    expect(rows({ scope: 'everyone', listed }).shown.map((row) => [row.author, row.mine])).toEqual([
      ['Jane Doe', false],
      ['You', true],
    ]);
  });

  it('shows nothing and notes nothing for an empty list', () => {
    expect(rows({})).toEqual({ shown: [], note: null });
  });
});
