import { describe, expect, it } from 'vitest';
import type { PartialIncomingItem } from '@shared/domain/incoming';
import { canUpdatePartial, firstPartialItemKey, morePartialItems, partialConflictNote, partialItemDetail, partialItemDiffEntry, partialItemGroups, partialItemKey, partialSelectionDetail } from './partialIncomingItems';

const item = (kind: PartialIncomingItem['kind'], path: string, extra: Partial<PartialIncomingItem> = {}): PartialIncomingItem => ({
  kind,
  path,
  isDirectory: false,
  conflict: false,
  loadedRevisionId: kind === 'added' ? null : 1,
  headRevisionId: kind === 'removed' ? null : 2,
  ...extra,
});

describe('partialItemGroups', () => {
  it('puts conflicts first, then what changed, moved, was removed and was added, leaving out empty groups', () => {
    const groups = partialItemGroups([
      item('added', 'Art/new.png'),
      item('changed', 'Code/Ship.cs'),
      item('changed', 'Code/Hull.cs', { conflict: true }),
      item('removed', 'Old/gone.txt'),
    ]);

    expect(groups.map((group) => [group.title, group.items.map((each) => each.path)])).toEqual([
      ['Conflicts', ['Code/Hull.cs']],
      ['Changed', ['Code/Ship.cs']],
      ['Removed', ['Old/gone.txt']],
      ['Added', ['Art/new.png']],
    ]);
  });

  it('sorts each group as every file list does (comparePaths)', () => {
    const groups = partialItemGroups([item('changed', 'b.txt'), item('changed', 'A/c.txt'), item('changed', 'a.txt')]);

    expect(groups[0]!.items.map((each) => each.path)).toEqual(['A/c.txt', 'a.txt', 'b.txt']);
  });

  it('has no group when nothing comes', () => {
    expect(partialItemGroups([])).toEqual([]);
  });
});

describe('partialItemDetail', () => {
  it('says where a moved item was, and what a conflict means', () => {
    expect(partialItemDetail(item('moved', 'Code/Ship.cs', { oldPath: 'Ship.cs' }))).toBe('Moved from Ship.cs');
    expect(partialItemDetail(item('changed', 'Code/Ship.cs', { conflict: true }))).toBe('Changed here and on the branch');
    expect(partialItemDetail(item('removed', 'Ship.cs'))).toBe('Removed');
    expect(partialItemDetail(item('added', 'Ship.cs'))).toBe('Added');
    expect(partialItemDetail(item('changed', 'Ship.cs'))).toBe('Changed');
  });
});

describe('partialConflictNote', () => {
  it('says the items changed here too keep the local version', () => {
    expect(partialConflictNote(1)).toBe('1 item you changed keeps your version');
    expect(partialConflictNote(3)).toBe('3 items you changed keep your version');
  });
});

describe('partialItemDiffEntry', () => {
  const repository = 'game@local';

  it('compares a changed or moved file from the loaded revision to the head’s', () => {
    expect(partialItemDiffEntry(item('changed', 'Code/Ship.cs'), repository)).toEqual({
      status: 'changed',
      path: 'Code/Ship.cs',
      itemType: 'file',
      baseRevisionId: 1,
      revisionId: 2,
      repository,
    });
    expect(partialItemDiffEntry(item('moved', 'Code/Hull.cs', { oldPath: 'Hull.cs' }), repository)).toMatchObject({ status: 'moved', path: 'Code/Hull.cs', oldPath: 'Hull.cs' });
  });

  it('shows an added file against nothing, and a removed one as it was', () => {
    expect(partialItemDiffEntry(item('added', 'Art/new.png'), repository)).toMatchObject({ status: 'added', baseRevisionId: -1, revisionId: 2 });
    expect(partialItemDiffEntry(item('removed', 'Old/gone.txt'), repository)).toMatchObject({ status: 'deleted', baseRevisionId: 1, revisionId: -1 });
  });

  it('has no diff for a directory, nor before the repository is known', () => {
    expect(partialItemDiffEntry(item('added', 'Art', { isDirectory: true }), repository)).toBeNull();
    expect(partialItemDiffEntry(item('changed', 'Code/Ship.cs'), undefined)).toBeNull();
  });
});

describe('partialItemKey', () => {
  it('tells apart a removed and an added item at the same path', () => {
    expect(partialItemKey(item('removed', 'Code/Ship.cs'))).not.toEqual(partialItemKey(item('added', 'Code/Ship.cs')));
  });
});

describe('firstPartialItemKey', () => {
  it('selects the first item listed, conflicts first', () => {
    const groups = partialItemGroups([item('added', 'a.txt'), item('changed', 'z.txt', { conflict: true })]);

    expect(firstPartialItemKey(groups)).toEqual(partialItemKey(item('changed', 'z.txt')));
  });

  it('selects nothing when nothing comes', () => {
    expect(firstPartialItemKey([])).toBeNull();
  });
});

describe('partialSelectionDetail', () => {
  const items = [item('changed', 'Code/Ship.cs'), item('moved', 'Src', { isDirectory: true, oldPath: 'Code' })];

  it('shows the diff of the selected file', () => {
    const detail = partialSelectionDetail(items, partialItemKey(items[0]!), 'game@local');

    expect(detail).toEqual({ kind: 'diff', entry: partialItemDiffEntry(items[0]!, 'game@local') });
  });

  it('says a folder has no diff', () => {
    expect(partialSelectionDetail(items, partialItemKey(items[1]!), 'game@local')).toEqual({ kind: 'empty', title: 'A folder has no diff' });
  });

  it('asks to select an item when none is, or the selected one is gone', () => {
    expect(partialSelectionDetail(items, null, 'game@local')).toEqual({ kind: 'empty', title: 'Select an item' });
    expect(partialSelectionDetail(items, partialItemKey(item('added', 'gone.txt')), 'game@local')).toEqual({ kind: 'empty', title: 'Select an item' });
  });
});

describe('canUpdatePartial', () => {
  it('updates while any item comes without colliding with a local change', () => {
    expect(canUpdatePartial(3, 2)).toBe(true);
  });

  it('has nothing to update when every item collides, or none comes', () => {
    expect(canUpdatePartial(2, 2)).toBe(false);
    expect(canUpdatePartial(0, 0)).toBe(false);
  });
});

describe('morePartialItems', () => {
  it('counts the items past those the card lists', () => {
    expect(morePartialItems(12, [item('added', 'a.txt'), item('added', 'b.txt')])).toBe(10);
  });

  it('counts none while the items load, or when the card lists them all', () => {
    expect(morePartialItems(12, undefined)).toBe(0);
    expect(morePartialItems(1, [item('added', 'a.txt')])).toBe(0);
  });
});
