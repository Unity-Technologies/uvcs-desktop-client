import { describe, expect, it } from 'vitest';
import type { Changeset } from '@shared/domain/changeset';
import { foldedChangesetsAuthors, showMoreBeforeKey } from './incomingChangesetSection';

const changeset = (id: number, owner: string): Changeset => ({ id, owner, comment: '', date: '2026-01-01T00:00:00Z', branch: '/main' }) as Changeset;

describe('showMoreBeforeKey', () => {
  // Shown oldest first: the next page is older still.
  it('goes above the oldest changeset shown while older ones remain', () => {
    expect(showMoreBeforeKey([changeset(2, 'ana'), changeset(3, 'ana')], true)).toBe('2');
  });

  it('is none once every changeset is read, or while the filter shows none', () => {
    expect(showMoreBeforeKey([changeset(2, 'ana')], false)).toBeUndefined();
    expect(showMoreBeforeKey([], true)).toBeUndefined();
  });
});

describe('foldedChangesetsAuthors', () => {
  it('names each author once, after the folded All incoming changes row', () => {
    expect(foldedChangesetsAuthors([changeset(4, 'ana@x.com'), changeset(3, 'luis.gomez@x.com'), changeset(2, 'ana@x.com')])).toBe('from Ana, Luis Gomez');
  });

  it('names the first few authors and counts the rest', () => {
    const owners = ['ana', 'bob', 'cai', 'dee', 'eve'];
    expect(foldedChangesetsAuthors(owners.map((owner, index) => changeset(index, owner)))).toBe('from Ana, Bob, Cai and 2 more');
  });

  it('says nothing without changesets', () => {
    expect(foldedChangesetsAuthors([])).toBe('');
  });
});
