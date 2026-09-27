import { describe, expect, it } from 'vitest';
import type { TreeItem } from '@shared/domain/explorer';
import type { PendingChange } from '@shared/domain/pendingChanges';
import { iconOverlay, itemStatus, PendingChangesIndex } from './itemStatus';

const xlink = { writable: true, path: '/', changeset: 12, repository: 'lib', server: 'local' };

describe('iconOverlay', () => {
  it('shows the pending status first', () => {
    expect(iconOverlay({ isPrivate: false, xlink }, { tone: 'changed', label: 'Changed' })).toBe('changed');
  });

  it('marks xlinks, private items and up-to-date controlled items', () => {
    expect(iconOverlay({ isPrivate: false, xlink }, null)).toBe('xlink');
    expect(iconOverlay({ isPrivate: true }, null)).toBe('private');
    expect(iconOverlay({ isPrivate: false }, null)).toBe('controlled');
  });

  it("leaves the check out of a repository tree, where everything is controlled, but keeps xlinks", () => {
    expect(iconOverlay({ isPrivate: false }, null, false)).toBe('none');
    expect(iconOverlay({ isPrivate: false, xlink }, null, false)).toBe('xlink');
  });
});

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
