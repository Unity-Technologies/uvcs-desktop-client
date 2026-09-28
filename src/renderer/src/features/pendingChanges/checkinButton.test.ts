import { describe, expect, it } from 'vitest';
import { checkinButtonLabel, checkinDisabledReason } from './checkinButton';

describe('checkinButtonLabel', () => {
  const base = { mode: 'checkin' as const, includedCount: 4, branchName: '/main', uploadBytes: 1_150_000, merging: false, behindCount: 0, allReviewed: false };

  const wordings = (label: ReturnType<typeof checkinButtonLabel>): string[] =>
    label.forms.map(({ action, size, target }) => [action, size && `(${size})`, target].filter(Boolean).join(' '));

  it('names the count, the upload size and the branch, and keeps the size longest', () => {
    expect(wordings(checkinButtonLabel({ ...base, branchName: '/main/task' }))).toEqual([
      'Check in 4 changes (1.1 MB) to task',
      'Check in 4 changes (1.1 MB)',
      'Check in 4 (1.1 MB)',
      'Check in 4',
    ]);
  });

  it('writes big counts with thousands separators, in every wording', () => {
    expect(wordings(checkinButtonLabel({ ...base, includedCount: 3008, uploadBytes: 0 }))).toEqual(['Check in 3,008 changes to main', 'Check in 3,008 changes', 'Check in 3,008']);
  });

  it('names a branch by its leaf, and the whole branch in the tooltip', () => {
    const label = checkinButtonLabel({ ...base, branchName: '/main/scm1008874/scm1008874d' });
    expect(wordings(label)[0]).toBe('Check in 4 changes (1.1 MB) to scm1008874d');
    expect(label.tip).toBe('Check in to /main/scm1008874/scm1008874d');
  });

  it('leaves the size out when nothing is uploaded', () => {
    expect(wordings(checkinButtonLabel({ ...base, includedCount: 1, uploadBytes: 0 }))).toEqual(['Check in 1 change to main', 'Check in 1 change', 'Check in 1']);
  });

  it('says a few bytes as bytes', () => {
    expect(wordings(checkinButtonLabel({ ...base, uploadBytes: 194 }))[0]).toBe('Check in 4 changes (194 B) to main');
  });

  it('says there is nothing to check in', () => {
    expect(wordings(checkinButtonLabel({ ...base, includedCount: 0 }))).toEqual(['Nothing to check in']);
  });

  it('checks in a merge', () => {
    expect(wordings(checkinButtonLabel({ ...base, merging: true }))).toEqual(['Check in merge (1.1 MB) to main', 'Check in merge (1.1 MB)', 'Check in merge']);
  });

  it('updates first when the branch moved on', () => {
    const label = checkinButtonLabel({ ...base, includedCount: 3, behindCount: 1 });
    expect(wordings(label)).toEqual([
      'Update & check in 3 changes (1.1 MB) to main',
      'Update & check in 3 changes (1.1 MB)',
      'Update & check in 3 (1.1 MB)',
      'Update & check in 3',
    ]);
    expect(label.tip).toBe('Update, then check in to /main');
  });

  it('says the changes are reviewed once all of them are', () => {
    expect(wordings(checkinButtonLabel({ ...base, allReviewed: true }))).toEqual([
      'Check in reviewed changes (1.1 MB) to main',
      'Check in reviewed changes (1.1 MB)',
      'Check in 4 (1.1 MB)',
      'Check in 4',
    ]);
  });

  it('prefers updating first over the reviewed wording, and never updates for a merge', () => {
    expect(wordings(checkinButtonLabel({ ...base, uploadBytes: 0, behindCount: 2, allReviewed: true }))[0]).toBe('Update & check in 4 changes to main');
    expect(wordings(checkinButtonLabel({ ...base, uploadBytes: 0, behindCount: 2, merging: true }))[0]).toBe('Check in merge to main');
  });

  it('shelves without naming the branch', () => {
    expect(wordings(checkinButtonLabel({ ...base, mode: 'shelve' }))).toEqual(['Shelve 4 changes (1.1 MB)', 'Shelve 4 (1.1 MB)', 'Shelve 4']);
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
