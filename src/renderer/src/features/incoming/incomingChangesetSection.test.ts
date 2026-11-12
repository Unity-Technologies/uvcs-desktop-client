import { describe, expect, it } from 'vitest';
import type { Changeset } from '@shared/domain/changeset';
import { changesetsSummary, showMoreBeforeKey } from './incomingChangesetSection';

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

describe('changesetsSummary', () => {
  it('counts the changesets and names each author once, as the closed header says it', () => {
    expect(changesetsSummary([changeset(4, 'ana@x.com'), changeset(3, 'luis.gomez@x.com'), changeset(2, 'ana@x.com')], false)).toBe('3 changesets · Ana, Luis Gomez');
  });

  it('names the first few authors and counts the rest', () => {
    const owners = ['ana', 'bob', 'cai', 'dee', 'eve'];
    expect(changesetsSummary(owners.map((owner, index) => changeset(index, owner)), false)).toBe('5 changesets · Ana, Bob, Cai and 2 more');
  });

  it('says one changeset in the singular', () => {
    expect(changesetsSummary([changeset(4, 'ana')], false)).toBe('1 changeset · Ana');
  });

  it('says at least as many as were read while older ones remain', () => {
    expect(changesetsSummary([changeset(4, 'ana'), changeset(3, 'ana')], true)).toBe('2+ changesets · Ana');
  });
});
