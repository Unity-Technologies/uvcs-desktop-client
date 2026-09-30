import { describe, expect, it } from 'vitest';
import type { PendingChange } from '@shared/domain/pendingChanges';
import { checkinSelectionOf, includedBy } from './checkinSelection';

const change = (path: string, kinds: PendingChange['kinds'], size = 10, itemType: PendingChange['itemType'] = 'file'): PendingChange => ({ path, kinds, itemType, size, lastModified: '' });

const edited = change('src/a.ts', ['checkedOut', 'changed'], 100);
const added = change('src/new.ts', ['added'], 20);
const privateFile = change('notes.txt', ['private'], 5);
const ignored = change('build/out.bin', ['ignored'], 999);
const hidden = change('local.cfg', ['hiddenChanged'], 7);
const link = change('src/link', ['changed'], 1, 'symlink');
const all = [edited, added, privateFile, ignored, hidden, link];

describe('includedBy', () => {
  it('takes every change that can be checked in, private files too, but ignored, cloaked and hidden ones', () => {
    expect(all.filter(includedBy(new Set()))).toEqual([edited, added, privateFile, link]);
  });

  it('leaves out the changes whose box was unchecked', () => {
    expect(all.filter(includedBy(new Set(['src/a.ts', 'notes.txt'])))).toEqual([added, link]);
  });
});

describe('checkinSelectionOf', () => {
  it('checks in every included change, whatever the filter shows: the filter only narrows the list', () => {
    const selection = checkinSelectionOf(all, includedBy(new Set(['src/new.ts'])));

    expect(selection.included).toEqual([edited, privateFile, link]);
  });

  it('shelves what a shelve can take: no private files, no links', () => {
    const selection = checkinSelectionOf(all, includedBy(new Set()));

    expect(selection.shelvable).toEqual([edited, added]);
    expect(selection.shelvableUpload.bytes).toBe(120);
    expect(selection.upload.bytes).toBe(126);
  });

  it('warns about many private files only when they are included', () => {
    const generated = Array.from({ length: 60 }, (_, index) => change(`gen/f${index}.cs`, ['private']));

    expect(checkinSelectionOf(generated, includedBy(new Set())).bulkPrivate?.fileCount).toBe(60);
    expect(checkinSelectionOf(generated, includedBy(new Set(generated.map((item) => item.path)))).bulkPrivate).toBeNull();
  });
});
