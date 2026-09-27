import { describe, expect, it } from 'vitest';
import { itemDecoration } from './itemDecoration';

const controlled = { isPrivate: false };

describe('itemDecoration', () => {
  it('marks nothing on a controlled item that is up to date, in a workspace or a repository', () => {
    expect(itemDecoration(controlled, null)).toEqual({ status: null, presence: 'controlled' });
  });

  it('keeps the letter of each pending status and of a checkout', () => {
    const changed = { tone: 'changed' as const, label: 'Checked out' };
    expect(itemDecoration(controlled, changed)).toEqual({ status: changed, presence: 'controlled' });
    expect(itemDecoration(controlled, { tone: 'moved', label: 'Moved' }).status?.tone).toBe('moved');
  });

  it('dims private and ignored items instead of marking them', () => {
    expect(itemDecoration({ isPrivate: true }, null)).toEqual({ status: null, presence: 'private' });
    expect(itemDecoration({ isPrivate: true }, { tone: 'private', label: 'Private' })).toEqual({ status: null, presence: 'private' });
    expect(itemDecoration({ isPrivate: true }, { tone: 'muted', label: 'Ignored' })).toEqual({ status: null, presence: 'ignored' });
  });

  it('shows an item being added as controlled, with its letter', () => {
    expect(itemDecoration({ isPrivate: true }, { tone: 'added', label: 'Added' })).toEqual({ status: { tone: 'added', label: 'Added' }, presence: 'controlled' });
  });
});
