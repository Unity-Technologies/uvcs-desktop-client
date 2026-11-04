import { describe, expect, it } from 'vitest';
import type { ChangeKind, ItemType, PendingChange } from '@shared/domain/pendingChanges';
import type { FileListLayout } from '../../components/fileListViewStore';
import { fileRowKeys } from '../../components/fileRowKeys';
import { fileSteps, pendingArrival, selectNow } from '../diff/viewer/fileSteps';
import { sortChanges } from './changeOrder';
import { changeKey, layoutChangeRows } from './changeRows';

const item = (path: string, itemType: ItemType, kinds: ChangeKind[] = ['changed']): PendingChange => ({ path, kinds, itemType, size: 0, lastModified: '' });

/** A deleted file, then a private folder holding another folder and a file, as Changes lists them. */
const deletedThenPrivateFolder = [
  item('foo - Copy.cs', 'file', ['deleted']),
  item('privdir copy', 'directory', ['private']),
  item('privdir copy/New directory', 'directory', ['private']),
  item('privdir copy/privile.txt', 'file', ['private']),
];

const keysOf = (changes: PendingChange[], layout: FileListLayout = 'list') =>
  fileRowKeys(layoutChangeRows({ sorted: sortChanges(changes), changelists: [], layout, grouping: 'none' }));
const keyOf = (path: string) => changeKey(deletedThenPrivateFolder.find((change) => change.path === path)!);

describe("the rows Changes' diff steps on to", () => {
  it('are the changes with a diff to show, skipping every folder, whether private, deleted or moved, in a list or a tree', () => {
    const changes = [...deletedThenPrivateFolder, item('Old', 'directory', ['deleted']), item('Moved', 'directory', ['moved'])];
    const expected = [keyOf('foo - Copy.cs'), keyOf('privdir copy/privile.txt')];
    expect(keysOf(changes)).toEqual(expected);
    expect(keysOf(changes, 'tree')).toEqual(expected);
  });

  it('keep an xlink, a symlink and a binary, whose diffs show too', () => {
    const changes = [item('lib', 'xlink'), item('link', 'symlink'), item('logo.png', 'binaryFile')];
    expect(keysOf(changes)).toEqual(changes.map(changeKey));
  });

  it('take ↓ past a deleted file\'s last change over the private folders to the file in them, and ↑ back', () => {
    const keys = keysOf(deletedThenPrivateFolder);
    const selected: string[] = [];
    const list = { select: (key: string, done: () => void) => selectNow(done, () => void selected.push(key)), pathOf: (key: string) => key };
    fileSteps(keys, keyOf('foo - Copy.cs'), list, pendingArrival()).step(1);
    fileSteps(keys, keyOf('privdir copy/privile.txt'), list, pendingArrival()).step(-1);
    expect(selected).toEqual([keyOf('privdir copy/privile.txt'), keyOf('foo - Copy.cs')]);
  });
});
