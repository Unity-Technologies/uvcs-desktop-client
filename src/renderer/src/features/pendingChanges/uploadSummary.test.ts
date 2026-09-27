import { describe, expect, it } from 'vitest';
import type { PendingChange } from '@shared/domain/pendingChanges';
import { describeUpload, uploadSummary } from './uploadSummary';

function change(path: string, kinds: PendingChange['kinds'], size: number, extra: Partial<PendingChange> = {}): PendingChange {
  return { path, kinds, itemType: 'file', size, lastModified: '', ...extra };
}

describe('uploadSummary', () => {
  it('adds up new and edited files only', () => {
    const changes = [
      change('src/edited.ts', ['checkedOut', 'changed'], 1000),
      change('src/new.ts', ['added'], 200),
      change('notes/private.txt', ['private'], 30),
      change('moved.ts', ['moved'], 5000),
      change('gone.ts', ['deleted'], 7000),
      change('dir', ['added'], 4096, { itemType: 'directory' }),
      change('unchanged.ts', ['checkedOut'], 9000),
    ];
    const summary = uploadSummary(changes);
    expect(summary).toMatchObject({ bytes: 1230, newFiles: 2, editedFiles: 1 });
    expect(summary.largest?.path).toBe('src/edited.ts');
  });

  it('counts a moved file that was edited too', () => {
    expect(uploadSummary([change('b.ts', ['moved', 'changed'], 40)])).toMatchObject({ bytes: 40, editedFiles: 1 });
  });

  it('uploads nothing for moves and deletions', () => {
    expect(uploadSummary([change('a.ts', ['moved'], 10), change('b.ts', ['deleted'], 10)])).toEqual({ bytes: 0, newFiles: 0, editedFiles: 0, largest: null });
  });

  it('goes over 100,000 changes in a blink, as checking a box does', () => {
    const kinds: PendingChange['kinds'][] = [['added'], ['checkedOut', 'changed'], ['moved']];
    const many = Array.from({ length: 100_000 }, (_, index) => change(`Assets/f${index}.png`, kinds[index % 3]!, index));
    const started = performance.now();
    const summary = uploadSummary(many);
    expect(performance.now() - started).toBeLessThan(100);
    expect(summary.newFiles + summary.editedFiles).toBe(66_667);
  });
});

describe('describeUpload', () => {
  it('says how much is uploaded, of what, and the largest file', () => {
    const summary = uploadSummary([
      change('Assets/Art/Hero.psd', ['added'], 840_000),
      change('Assets/a.cs', ['added'], 100_000),
      change('Assets/b.cs', ['added'], 100_000),
      change('Assets/c.cs', ['changed'], 90_000),
      change('Assets/d.cs', ['changed'], 20_000),
    ]);
    expect(describeUpload(summary)).toBe('Uploads 1.1 MB: 3 new files, 2 edited\nLargest: Hero.psd · 820 KB');
  });

  it('names no largest file when only one is uploaded', () => {
    expect(describeUpload(uploadSummary([change('a.cs', ['changed'], 194)]))).toBe('Uploads 194 B: 1 edited file');
    expect(describeUpload(uploadSummary([change('a.cs', ['private'], 2048)]))).toBe('Uploads 2.0 KB: 1 new file');
  });

  it('says nothing when nothing is uploaded', () => {
    expect(describeUpload(uploadSummary([change('a.cs', ['deleted'], 10)]))).toBeNull();
  });
});
