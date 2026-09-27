import { describe, expect, it } from 'vitest';
import type { TreeItem } from '@shared/domain/explorer';
import type { PendingChange } from '@shared/domain/pendingChanges';
import { itemStatus, PendingChangesIndex } from './itemStatus';

describe('itemStatus', () => {
  const file = { path: 'app.ts', itemType: 'file', isPrivate: false, isCheckedOut: false, size: 15, date: '2026-09-01T10:00:00Z' } as TreeItem;
  const change = (overrides: Partial<PendingChange>): PendingChange => ({
    path: 'app.ts',
    kinds: ['changed'],
    itemType: 'file',
    size: 30,
    lastModified: '2026-09-27T13:32:04+02:00',
    ...overrides,
  });

  it('tells a changed file’s size and date on disk, not its loaded revision’s', () => {
    expect(itemStatus(file, new PendingChangesIndex([change({})]))).toEqual({
      tone: 'changed',
      label: 'Changed',
      onDisk: { size: 30, date: '2026-09-27T13:32:04+02:00' },
    });
  });

  it('has nothing on disk to tell for a deleted file or a folder', () => {
    expect(itemStatus(file, new PendingChangesIndex([change({ kinds: ['deleted'] })]))?.onDisk).toBeUndefined();
    const folder = { ...file, itemType: 'directory' } as TreeItem;
    expect(itemStatus(folder, new PendingChangesIndex([change({ kinds: ['checkedOut'], itemType: 'directory' })]))?.onDisk).toBeUndefined();
  });

  it('reads private and checked out items from the listing', () => {
    expect(itemStatus({ ...file, isPrivate: true }, new PendingChangesIndex([]))).toEqual({ tone: 'private', label: 'Private' });
    expect(itemStatus({ ...file, isCheckedOut: true }, new PendingChangesIndex([]))).toEqual({ tone: 'changed', label: 'Checked out' });
  });
});

describe('PendingChangesIndex', () => {
  const change = (path: string): PendingChange => ({ path, kinds: ['changed'], itemType: 'file', size: 1, lastModified: '' });
  const index = new PendingChangesIndex([change('src/a.ts'), change('src/ui/b.ts'), change('README.md')]);

  it('counts the changes anywhere below a folder, and all of them at the root', () => {
    expect(index.countInside('src')).toBe(2);
    expect(index.countInside('src/ui')).toBe(1);
    expect(index.countInside('docs')).toBe(0);
    expect(index.countInside('')).toBe(3);
    expect(index.hasChangesInside('src/ui')).toBe(true);
    expect(index.hasChangesInside('src/ui/b.ts')).toBe(false);
  });
});
