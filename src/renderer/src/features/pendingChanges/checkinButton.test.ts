import { describe, expect, it } from 'vitest';
import type { PendingChange } from '@shared/domain/pendingChanges';
import { checkinButtonLabel, checkinDisabledReason, mergeSourceChangeset, uploadSize } from './checkinButton';

function change(path: string, kinds: PendingChange['kinds'], size: number, extra: Partial<PendingChange> = {}): PendingChange {
  return { path, kinds, itemType: 'file', size, lastModified: '', ...extra };
}

describe('uploadSize', () => {
  it('adds up new and edited files only', () => {
    const changes = [
      change('edited.ts', ['checkedOut', 'changed'], 1000),
      change('new.ts', ['added'], 200),
      change('private.txt', ['private'], 30),
      change('moved.ts', ['moved'], 5000),
      change('gone.ts', ['deleted'], 7000),
      change('dir', ['added'], 4096, { itemType: 'directory' }),
      change('unchanged.ts', ['checkedOut'], 9000),
    ];
    expect(uploadSize(changes)).toBe(1230);
  });
});

describe('checkinButtonLabel', () => {
  const base = { mode: 'checkin' as const, includedCount: 4, branchName: '/main', uploadBytes: 1_150_000, merging: false };

  it('names the count, the branch and the upload size', () => {
    expect(checkinButtonLabel(base)).toMatchObject({ action: 'Check in 4 changes', target: 'to /main', size: '1.1 MB' });
  });

  it('leaves the size out when nothing is uploaded', () => {
    expect(checkinButtonLabel({ ...base, includedCount: 1, uploadBytes: 0 })).toMatchObject({ action: 'Check in 1 change', size: null });
  });

  it('says there is nothing to check in', () => {
    expect(checkinButtonLabel({ ...base, includedCount: 0 })).toMatchObject({ action: 'Nothing to check in', target: null, size: null });
  });

  it('checks in a merge', () => {
    expect(checkinButtonLabel({ ...base, merging: true })).toMatchObject({ action: 'Check in merge', target: 'to /main' });
  });

  it('shelves without naming the branch', () => {
    expect(checkinButtonLabel({ ...base, mode: 'shelve' })).toMatchObject({ action: 'Shelve 4 changes', target: null });
  });
});

describe('checkinDisabledReason', () => {
  it('asks to select changes when none are checked', () => {
    expect(checkinDisabledReason('checkin', 0)).toBe('Select changes to check in');
    expect(checkinDisabledReason('shelve', 0)).toBe('Select changes to shelve');
    expect(checkinDisabledReason('checkin', 2)).toBeNull();
  });
});

describe('mergeSourceChangeset', () => {
  it('reads the source changeset of a pending merge', () => {
    expect(mergeSourceChangeset([change('a.ts', ['changed'], 1), change('b.ts', ['checkedOut'], 1, { mergeInfo: 'Merge from 12' })])).toBe(12);
  });

  it('is null without a merge', () => {
    expect(mergeSourceChangeset([change('a.ts', ['changed'], 1)])).toBeNull();
  });
});
