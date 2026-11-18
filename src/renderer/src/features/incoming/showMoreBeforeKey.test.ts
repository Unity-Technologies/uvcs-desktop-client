import { describe, expect, it } from 'vitest';
import type { Changeset } from '@shared/domain/changeset';
import { showMoreBeforeKey } from './showMoreBeforeKey';

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
