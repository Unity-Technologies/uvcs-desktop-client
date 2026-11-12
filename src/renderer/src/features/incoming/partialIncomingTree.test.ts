import { describe, expect, it } from 'vitest';
import type { PartialIncomingItem } from '@shared/domain/incoming';
import type { GroupedTreeRow } from '../../lib/groupedPathTree';
import { wholeList } from '../../lib/itemRange';
import { partialItemGroups, partialItemKey } from './partialIncomingItems';
import { PARTIAL_ITEM_FACTS, partialItemAt, partialItemStatus, partialItemTones, partialItemTreeGroups } from './partialIncomingTree';

const item = (kind: PartialIncomingItem['kind'], path: string, extra: Partial<PartialIncomingItem> = {}): PartialIncomingItem => ({
  kind,
  path,
  isDirectory: false,
  conflict: false,
  loadedRevisionId: kind === 'added' ? null : 1,
  headRevisionId: kind === 'removed' ? null : 2,
  ...extra,
});

describe('partialItemTones', () => {
  it('names what the branch did to the item, a removed one as deleted', () => {
    expect(['changed', 'moved', 'removed', 'added'].map((kind) => partialItemTones(item(kind as PartialIncomingItem['kind'], 'a.txt')))).toEqual([
      ['changed'],
      ['moved'],
      ['deleted'],
      ['added'],
    ]);
  });

  it('adds the conflict, which the row shows as its own status', () => {
    const conflict = item('changed', 'a.txt', { conflict: true });
    expect(partialItemTones(conflict)).toEqual(['changed', 'conflict']);
    expect(PARTIAL_ITEM_FACTS.toneOf(conflict)).toBe('conflict');
  });
});

describe('partialItemStatus', () => {
  it('shows the letter of what the branch did, with the item\'s line as its label', () => {
    expect(partialItemStatus(item('moved', 'New/a.txt', { oldPath: 'Old/a.txt' }))).toEqual({ tone: 'moved', label: 'Moved from Old/a.txt' });
    expect(partialItemStatus(item('removed', 'gone.txt'))).toEqual({ tone: 'deleted', label: 'Removed' });
  });
});

describe('partialItemTreeGroups', () => {
  it('keeps the groups and their order, each holding its items', () => {
    const groups = partialItemTreeGroups(partialItemGroups([item('added', 'b.txt'), item('changed', 'a.txt', { conflict: true })]));
    expect(groups.map((group) => [group.key, group.label, group.sorted.map((each) => each.path)])).toEqual([
      ['group:Conflicts', 'Conflicts', ['a.txt']],
      ['group:Added', 'Added', ['b.txt']],
    ]);
  });
});

describe('partialItemAt', () => {
  const file = item('changed', 'Code/Ship.cs');
  const folder = item('moved', 'Art', { isDirectory: true, oldPath: 'Images' });
  const items = [file, folder];
  const folderRow: GroupedTreeRow<PartialIncomingItem, string> = { type: 'folder', key: 'row:Art', path: 'Art', name: 'Art', depth: 0, item: folder, held: wholeList([folder]), collapsed: false };
  const plainFolderRow: GroupedTreeRow<PartialIncomingItem, string> = { type: 'folder', key: 'row:Code', path: 'Code', name: 'Code', depth: 0, held: wholeList([file]), collapsed: false };
  const rows = [folderRow, plainFolderRow];

  it('finds an item by its own key', () => {
    expect(partialItemAt(items, rows, partialItemKey(file))).toBe(file);
  });

  it('finds the item a folder row is, and none for a folder that only holds items', () => {
    expect(partialItemAt(items, rows, 'row:Art')).toBe(folder);
    expect(partialItemAt(items, rows, 'row:Code')).toBeUndefined();
  });

  it('finds nothing for an unknown key or no selection', () => {
    expect(partialItemAt(items, rows, 'nothing')).toBeUndefined();
    expect(partialItemAt(items, rows, null)).toBeUndefined();
  });
});
