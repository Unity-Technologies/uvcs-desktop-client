import type { DiffEntry } from '@shared/domain/diff';
import { describe, expect, it } from 'vitest';
import type { LoadedItem } from '../cm/loadedItems';
import { countEntriesNeedingMerge, foldersShelveTouches } from './shelveAppliesWithoutMerge';

function entry(status: DiffEntry['status'], path: string, baseRevisionId: number, more: Partial<DiffEntry> = {}): DiffEntry {
  return { status, path, itemType: 'file', baseRevisionId, revisionId: 90, repository: 'eco@local', ...more };
}

function file(path: string, revisionId: number, checkedOut = false): LoadedItem {
  return { path, isDirectory: false, revisionId, checkedOut };
}

function folder(path: string): LoadedItem {
  return { path, isDirectory: true, revisionId: 7, checkedOut: false };
}

describe('foldersShelveTouches', () => {
  it('names each folder holding a shelved item once, the root as an empty path', () => {
    const entries = [entry('changed', 'Code/Engine.cs', 15), entry('changed', 'Code/Hull.cs', 38), entry('added', 'readme.md', -1)];

    expect(foldersShelveTouches(entries)).toEqual(['', 'Code']);
  });

  it('names where a moved item was and where it went', () => {
    expect(foldersShelveTouches([entry('moved', 'Art/Ship.png', 4, { oldPath: 'Old/Ship.png' })])).toEqual(['Art', 'Old']);
  });

  it('leaves out the folders the shelve adds, which the workspace can’t have yet', () => {
    const entries = [entry('added', 'Code/Ai', -1, { itemType: 'directory' }), entry('added', 'Code/Ai/Brain.cs', -1), entry('added', 'Code/Ai/Deep/Net.cs', -1)];

    expect(foldersShelveTouches(entries)).toEqual(['Code']);
  });
});

describe('countEntriesNeedingMerge', () => {
  it('needs none when every changed or deleted item is loaded at the revision the shelve started from', () => {
    const entries = [entry('changed', 'Code/Engine.cs', 15), entry('deleted', 'Code/Hull.cs', 38)];
    const loaded = [folder('Code'), file('Code/Engine.cs', 15), file('Code/Hull.cs', 38)];

    expect(countEntriesNeedingMerge(entries, loaded)).toBe(0);
  });

  it('needs a merge for an item loaded at another revision, checked out, or not loaded at all', () => {
    const entries = [entry('changed', 'Code/Engine.cs', 15), entry('changed', 'Code/Hull.cs', 38), entry('deleted', 'Code/Gone.cs', 3)];
    const loaded = [folder('Code'), file('Code/Engine.cs', 22), file('Code/Hull.cs', -1, true)];

    expect(countEntriesNeedingMerge(entries, loaded)).toBe(3);
  });

  it('adds an item into the root, a loaded folder or a folder the shelve adds, where nothing is', () => {
    const entries = [
      entry('added', 'readme.md', -1),
      entry('added', 'Code/New.cs', -1),
      entry('added', 'Code/Ai', -1, { itemType: 'directory' }),
      entry('added', 'Code/Ai/Brain.cs', -1),
    ];

    expect(countEntriesNeedingMerge(entries, [folder(''), folder('Code')])).toBe(0);
  });

  it('needs a merge to add an item where one already is, or into a folder the workspace hasn’t loaded', () => {
    const entries = [entry('added', 'Code/New.cs', -1), entry('added', 'Art/Ship.png', -1)];

    expect(countEntriesNeedingMerge(entries, [folder('Code'), file('Code/New.cs', 4)])).toBe(2);
  });

  it('moves an item loaded at its base revision to a free path in a loaded folder', () => {
    const entries = [entry('moved', 'Art/Ship.png', 4, { oldPath: 'Old/Ship.png' })];

    expect(countEntriesNeedingMerge(entries, [folder('Art'), folder('Old'), file('Old/Ship.png', 4)])).toBe(0);
    expect(countEntriesNeedingMerge(entries, [folder('Art'), folder('Old'), file('Old/Ship.png', 5)])).toBe(1);
    expect(countEntriesNeedingMerge(entries, [folder('Art'), folder('Old'), file('Old/Ship.png', 4), file('Art/Ship.png', 9)])).toBe(1);
    expect(countEntriesNeedingMerge(entries, [folder('Old'), file('Old/Ship.png', 4)])).toBe(1);
  });
});
