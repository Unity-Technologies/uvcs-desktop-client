import { describe, expect, it } from 'vitest';
import type { Suggestion } from './suggestionItems';
import { isDismissed, nextPickable, suggestionKeyAction, suggestionRows, type ChangesetLookup, type ChangesetSearch } from './suggestionRows';

function changeset(id: number): Suggestion {
  return { key: `cs:${id}`, kind: 'changeset', label: String(id), insert: `cs:${id}` };
}

const NONE: { lookup: ChangesetLookup; search: ChangesetSearch } = { lookup: { state: 'none' }, search: { state: 'none' } };
const read = (suggestions: Suggestion[]) => ({ suggestions, reading: false, failed: false });

describe('suggestionRows', () => {
  it('lists what matched', () => {
    expect(suggestionRows('branch', 'ta', read([{ key: 'br:/t', kind: 'branch', label: '/t', insert: 'br:/t' }]))).toEqual([
      { kind: 'pick', suggestion: { key: 'br:/t', kind: 'branch', label: '/t', insert: 'br:/t' } },
    ]);
  });

  it('says the list is being read, then that nothing matched', () => {
    expect(suggestionRows('label', 'v1', { suggestions: [], reading: true, failed: false })).toEqual([{ kind: 'note', text: 'Reading labels…', pending: true }]);
    expect(suggestionRows('label', 'v1', read([]))).toEqual([{ kind: 'note', text: 'No labels match “v1”' }]);
    expect(suggestionRows('person', '', read([]))).toEqual([{ kind: 'note', text: 'No people' }]);
  });

  it('says a list couldn’t be read, for every kind, never that the repository has none', () => {
    const words = { changeset: 'changesets', branch: 'branches', label: 'labels', shelve: 'shelves', codeReview: 'code reviews', person: 'people' } as const;
    for (const [kind, noun] of Object.entries(words)) {
      expect(suggestionRows(kind as keyof typeof words, 'v1', { suggestions: [], reading: false, failed: true }, kind === 'changeset' ? NONE : undefined)).toEqual([{ kind: 'note', text: `Couldn't read ${noun}` }]);
    }
  });

  it('closes the emoji list when nothing matches', () => {
    expect(suggestionRows('emoji', 'zzz', read([]))).toEqual([]);
  });

  describe('changesets', () => {
    it('look up a number the newest ones don’t hold', () => {
      expect(suggestionRows('changeset', '12', read([changeset(4120)]), { ...NONE, lookup: { state: 'reading', id: 12 } })).toEqual([
        { kind: 'pick', suggestion: changeset(4120) },
        { kind: 'note', text: 'Looking up changeset 12…', pending: true },
      ]);
      expect(suggestionRows('changeset', '12', read([]), { ...NONE, lookup: { state: 'found', suggestion: changeset(12) } })).toEqual([{ kind: 'pick', suggestion: changeset(12) }]);
      expect(suggestionRows('changeset', '12', read([]), { ...NONE, lookup: { state: 'missing', id: 12 } })).toEqual([{ kind: 'note', text: 'No changeset 12' }]);
    });

    it('look nothing up for a number among them', () => {
      expect(suggestionRows('changeset', '12', read([changeset(12)]), { ...NONE, lookup: { state: 'reading', id: 12 } })).toEqual([{ kind: 'pick', suggestion: changeset(12) }]);
    });

    it('offer to search them all for words, last, and show what the search found', () => {
      expect(suggestionRows('changeset', 'switch', read([changeset(4207)]), NONE)).toEqual([
        { kind: 'pick', suggestion: changeset(4207) },
        { kind: 'searchAll', text: 'switch' },
      ]);
      expect(suggestionRows('changeset', 'switch', read([]), { ...NONE, search: { state: 'searching', text: 'switch' } })).toEqual([{ kind: 'note', text: 'Searching all changesets…', pending: true }]);
      expect(suggestionRows('changeset', 'switch', read([changeset(4207)]), { ...NONE, search: { state: 'found', text: 'switch', suggestions: [changeset(4207), changeset(80)] } })).toEqual([
        { kind: 'pick', suggestion: changeset(4207) },
        { kind: 'pick', suggestion: changeset(80) },
      ]);
    });

    it('offer the search again once the words typed change', () => {
      expect(suggestionRows('changeset', 'switc', read([]), { ...NONE, search: { state: 'found', text: 'switch', suggestions: [] } })).toEqual([{ kind: 'searchAll', text: 'switc' }]);
    });

    it('say nothing matched when the search found nothing', () => {
      expect(suggestionRows('changeset', 'zzz', read([]), { ...NONE, search: { state: 'found', text: 'zzz', suggestions: [] } })).toEqual([{ kind: 'note', text: 'No changesets match “zzz”' }]);
    });
  });
});

describe('nextPickable', () => {
  const rows = [{ kind: 'pick', suggestion: changeset(1) }, { kind: 'note', text: '…' }, { kind: 'searchAll', text: 'x' }] as const;

  it('steps over notes, wrapping around', () => {
    expect(nextPickable(rows, 0, 1)).toBe(2);
    expect(nextPickable(rows, 2, 1)).toBe(0);
    expect(nextPickable(rows, 0, -1)).toBe(2);
    expect(nextPickable([{ kind: 'note', text: '…' }], 0, 1)).toBe(-1);
  });
});

describe('suggestionKeyAction', () => {
  const picks = [{ kind: 'pick', suggestion: changeset(1) }, { kind: 'pick', suggestion: changeset(2) }] as const;
  const onlyNote = [{ kind: 'note', text: 'No branches match “x”' }] as const;
  const none = { metaKey: false, ctrlKey: false, altKey: false, shiftKey: false };

  it('moves through the rows that can be picked with the arrows', () => {
    expect(suggestionKeyAction('ArrowDown', none, picks, 0)).toEqual({ kind: 'move', to: 1 });
    expect(suggestionKeyAction('ArrowUp', none, picks, 0)).toEqual({ kind: 'move', to: 1 });
  });

  it('leaves the arrows to the caret when nothing can be picked', () => {
    expect(suggestionKeyAction('ArrowDown', none, onlyNote, 0)).toBeNull();
    expect(suggestionKeyAction('ArrowUp', none, onlyNote, 0)).toBeNull();
  });

  it('picks with Enter or Tab, without a modifier, a row that can be picked', () => {
    expect(suggestionKeyAction('Enter', none, picks, 1)).toEqual({ kind: 'pick', index: 1 });
    expect(suggestionKeyAction('Tab', none, picks, 0)).toEqual({ kind: 'pick', index: 0 });
    expect(suggestionKeyAction('Enter', { ...none, metaKey: true }, picks, 0)).toBeNull();
    expect(suggestionKeyAction('Tab', { ...none, shiftKey: true }, picks, 0)).toBeNull();
    expect(suggestionKeyAction('Enter', none, onlyNote, 0)).toBeNull();
  });

  it('dismisses with Esc, and leaves every other key to the text', () => {
    expect(suggestionKeyAction('Escape', none, onlyNote, 0)).toEqual({ kind: 'dismiss' });
    expect(suggestionKeyAction('a', none, picks, 0)).toBeNull();
  });
});

describe('isDismissed', () => {
  it('keeps the list closed for the word Esc closed it on, and opens it for another', () => {
    expect(isDismissed({ kind: 'branch', from: 4, to: 8, text: 'ta' }, 4)).toBe(true);
    expect(isDismissed({ kind: 'branch', from: 12, to: 15, text: 'ma' }, 4)).toBe(false);
    expect(isDismissed({ kind: 'branch', from: 4, to: 8, text: 'ta' }, null)).toBe(false);
  });
});
