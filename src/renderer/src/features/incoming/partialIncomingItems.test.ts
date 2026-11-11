import { describe, expect, it } from 'vitest';
import type { PartialIncomingChanges, PartialIncomingItem } from '@shared/domain/incoming';
import { partialItemDetail, partialItemGroups, partialUpdateMessage } from './partialIncomingItems';

const item = (kind: PartialIncomingItem['kind'], path: string, extra: Partial<PartialIncomingItem> = {}): PartialIncomingItem => ({
  kind,
  path,
  isDirectory: false,
  conflict: false,
  loadedRevisionId: kind === 'added' ? null : 1,
  headRevisionId: kind === 'removed' ? null : 2,
  ...extra,
});

const incoming = (...items: PartialIncomingItem[]): PartialIncomingChanges => ({ branch: '/main/task', partial: true, headChangeset: 12, items });

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

describe('partialUpdateMessage', () => {
  it('says how many items updating brings from the branch', () => {
    expect(partialUpdateMessage(incoming(item('changed', 'a.txt'), item('added', 'b.txt')))).toBe('Updating brings 2 items from task.');
  });

  it('says the items changed here too keep the local version', () => {
    expect(partialUpdateMessage(incoming(item('changed', 'a.txt'), item('changed', 'b.txt', { conflict: true })))).toBe(
      'Updating brings 1 item from task. 1 item you changed keeps your version until you check it in, shelve it or undo it.',
    );
  });

  it('says when every item collides with a local change', () => {
    expect(partialUpdateMessage(incoming(item('changed', 'a.txt', { conflict: true }), item('changed', 'b.txt', { conflict: true })))).toBe(
      '2 items you changed keep your version until you check them in, shelve them or undo them.',
    );
  });
});
