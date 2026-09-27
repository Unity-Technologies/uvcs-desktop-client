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
  const base = { mode: 'checkin' as const, includedCount: 4, branchName: '/main', uploadBytes: 1_150_000, merging: false, behindCount: 0, allReviewed: false };

  const wordings = (label: ReturnType<typeof checkinButtonLabel>): string[] =>
    label.forms.map(({ action, target, size }) => [action, target, size].filter(Boolean).join(' | '));

  it('names the count, the branch and the upload size, then drops them one by one', () => {
    expect(wordings(checkinButtonLabel(base))).toEqual(['Check in 4 changes | to /main | 1.1 MB', 'Check in 4 changes | to /main', 'Check in 4 changes', 'Check in 4']);
  });

  it('writes big counts with thousands separators, in every wording', () => {
    expect(wordings(checkinButtonLabel({ ...base, includedCount: 3008, uploadBytes: 0 }))).toEqual(['Check in 3,008 changes | to /main', 'Check in 3,008 changes', 'Check in 3,008']);
  });

  it('shortens a child branch to its leaf before dropping it', () => {
    expect(wordings(checkinButtonLabel({ ...base, branchName: '/main/scm1008874/scm1008874d', uploadBytes: 0 }))).toEqual([
      'Check in 4 changes | to /main/scm1008874/scm1008874d',
      'Check in 4 changes | to scm1008874d',
      'Check in 4 changes',
      'Check in 4',
    ]);
  });

  it('names the whole branch in the tooltip', () => {
    expect(checkinButtonLabel({ ...base, branchName: '/main/task' }).tip).toBe('Check in to /main/task');
  });

  it('leaves the size out when nothing is uploaded', () => {
    expect(wordings(checkinButtonLabel({ ...base, includedCount: 1, uploadBytes: 0 }))[0]).toBe('Check in 1 change | to /main');
  });

  it('says there is nothing to check in', () => {
    expect(wordings(checkinButtonLabel({ ...base, includedCount: 0 }))).toEqual(['Nothing to check in']);
  });

  it('checks in a merge', () => {
    expect(wordings(checkinButtonLabel({ ...base, merging: true }))).toEqual(['Check in merge | to /main | 1.1 MB', 'Check in merge | to /main', 'Check in merge']);
  });

  it('updates first when the branch moved on', () => {
    const label = checkinButtonLabel({ ...base, includedCount: 3, uploadBytes: 0, behindCount: 1 });
    expect(wordings(label)).toEqual(['Update & check in 3 changes | to /main', 'Update & check in 3 changes', 'Update & check in 3']);
    expect(label.tip).toBe('Update, then check in to /main');
  });

  it('says the changes are reviewed once all of them are', () => {
    expect(wordings(checkinButtonLabel({ ...base, uploadBytes: 0, allReviewed: true }))).toEqual([
      'Check in reviewed changes | to /main',
      'Check in reviewed changes',
      'Check in 4',
    ]);
  });

  it('prefers updating first over the reviewed wording, and never updates for a merge', () => {
    expect(wordings(checkinButtonLabel({ ...base, uploadBytes: 0, behindCount: 2, allReviewed: true }))[0]).toBe('Update & check in 4 changes | to /main');
    expect(wordings(checkinButtonLabel({ ...base, uploadBytes: 0, behindCount: 2, merging: true }))[0]).toBe('Check in merge | to /main');
  });

  it('shelves without naming the branch', () => {
    expect(wordings(checkinButtonLabel({ ...base, mode: 'shelve' }))).toEqual(['Shelve 4 changes | 1.1 MB', 'Shelve 4 changes', 'Shelve 4']);
  });

  it('tells shelving, which undoes the changes, from keeping them', () => {
    expect(checkinButtonLabel({ ...base, mode: 'shelve' }).tip).toBe('Shelve, then undo the changes here');
    expect(checkinButtonLabel({ ...base, mode: 'shelve', keepShelved: true }).tip).toBe('Shelve a copy; the changes stay here');
  });
});

describe('checkinDisabledReason', () => {
  it('asks to select changes when none are checked', () => {
    expect(checkinDisabledReason('checkin', 0, 0)).toBe('Select changes to check in');
    expect(checkinDisabledReason('shelve', 0, 0)).toBe('Select changes to shelve');
    expect(checkinDisabledReason('checkin', 2, 2)).toBeNull();
  });

  it('says why a shelve of only private files is not possible', () => {
    expect(checkinDisabledReason('shelve', 0, 3)).toBe("Private files and links can't be shelved");
    expect(checkinDisabledReason('shelve', 1, 3)).toBeNull();
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
