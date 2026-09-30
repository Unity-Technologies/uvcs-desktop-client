import { describe, expect, it } from 'vitest';
import type { PendingChange } from '@shared/domain/pendingChanges';
import { missingFromShelve, newItemPaths, shelvedChangelists, shelvedContents, summarizePending, topmostPaths } from './pendingSnapshot';

function change(path: string, kinds: PendingChange['kinds'], extra: Partial<PendingChange> = {}): PendingChange {
  return { path, kinds, itemType: 'file', size: 0, lastModified: '', ...extra };
}

const changed = change('src/a.txt', ['changed']);
const added = change('new.txt', ['added'], { changelist: 'cl1' });
const moved = change('m2.txt', ['moved'], { oldPath: 'm.txt' });
const unchangedCheckout = change('c.txt', ['checkedOut']);
const privateFile = change('p.txt', ['private']);

describe('summarizePending', () => {
  it('counts shelvable and private changes apart', () => {
    expect(summarizePending([changed, added, privateFile])).toEqual({ pendingCount: 2, privateCount: 1, unchangedCheckoutsOnly: false, inMerge: false });
  });

  it('tells when only unchanged checkouts are pending', () => {
    expect(summarizePending([unchangedCheckout, privateFile]).unchangedCheckoutsOnly).toBe(true);
    expect(summarizePending([privateFile]).unchangedCheckoutsOnly).toBe(false);
    expect(summarizePending([change('b.txt', ['checkedOut', 'changed'])]).unchangedCheckoutsOnly).toBe(false);
  });

  it('notices an unfinished merge', () => {
    expect(summarizePending([change('a.txt', ['changed'], { mergeInfo: 'Merge from 4' })]).inMerge).toBe(true);
  });
});

describe('missingFromShelve', () => {
  it('accepts a shelve holding every change; unchanged checkouts and private files may be missing', () => {
    expect(missingFromShelve([changed, added, moved, unchangedCheckout, privateFile], new Set(['src/a.txt', 'new.txt', 'm2.txt', 'm.txt']))).toEqual([]);
  });

  it('reports the changes the shelve lacks, like those inside Xlinks', () => {
    expect(missingFromShelve([changed, change('lib/x.c', ['changed'])], new Set(['src/a.txt']))).toEqual(['lib/x.c']);
  });
});

describe('newItemPaths', () => {
  it('lists the items that only exist because of the changes, folders without their contents', () => {
    const folder = change('assets', ['added'], { itemType: 'directory' });
    const inFolder = change('assets/logo.png', ['added']);
    const localMove = change('renamed.txt', ['locallyMoved'], { oldPath: 'old.txt' });
    expect(newItemPaths([changed, added, folder, inFolder, localMove, privateFile])).toEqual(['assets', 'new.txt', 'renamed.txt']);
  });
});

describe('topmostPaths', () => {
  it('does not confuse siblings sharing a prefix', () => {
    expect(topmostPaths(['a/b', 'a', 'ab/c'])).toEqual(['a', 'ab/c']);
  });
});

describe('shelvedChangelists', () => {
  it('keeps the changelists that hold shelved changes', () => {
    const snapshot = {
      changes: [changed, added],
      changelists: [
        { name: 'cl1', description: 'mine' },
        { name: 'empty', description: '' },
      ],
      mergeLinks: [],
    };
    expect(shelvedChangelists(snapshot)).toEqual([{ name: 'cl1', description: 'mine', paths: ['new.txt'] }]);
  });
});

describe('shelvedContents', () => {
  it('keeps the changed paths of the changes shelved, and only their changelists', () => {
    const snapshot = { changes: [changed, added, unchangedCheckout], changelists: [{ name: 'cl1', description: 'mine' }], mergeLinks: [] };
    expect(shelvedContents(snapshot)).toEqual({ paths: ['src/a.txt', 'new.txt'], changelists: [{ name: 'cl1', description: 'mine', paths: ['new.txt'] }] });
    expect(shelvedContents(snapshot, [changed])).toEqual({ paths: ['src/a.txt'], changelists: [] });
  });
});
