import { describe, expect, it } from 'vitest';
import { readLoadedItem, loadedItemsArgs } from './loadedItems';
import { formatOutput, recordsIn } from './testing/cmOutput';

const parseLoadedItems = (output: string) => recordsIn(output, readLoadedItem);

describe('loadedItemsArgs', () => {
  it('lists several folders in one command, with the revision and checkout of each item, links as themselves', () => {
    expect(loadedItemsArgs(['C:\\wk\\Code', 'C:\\wk\\Art'])).toEqual([
      'ls',
      'C:\\wk\\Code',
      'C:\\wk\\Art',
      '--format={wkpath}\u001f{type}\u001f{revid}\u001f{checkout}\u001e',
      '--symlink',
    ]);
  });
});

describe('readLoadedItem', () => {
  it('reads each folder, then its children, as cm lists them in a partial workspace', () => {
    // `cm ls <folder> --format=…` on Windows: the folder first, a checkout with revision -1 and CO, a private file with none.
    const output = formatOutput(
      ['Code', 'dir', -1, 'CO'],
      ['Code\\Engine.cs', 'txt', -1, 'CO'],
      ['Code\\Hull.cs', 'txt', 38, ''],
      ['Code\\notes.txt', 'txt', '', ''],
    );

    expect(parseLoadedItems(output)).toEqual([
      { path: 'Code', isDirectory: true, revisionId: -1, checkedOut: true },
      { path: 'Code/Engine.cs', isDirectory: false, revisionId: -1, checkedOut: true },
      { path: 'Code/Hull.cs', isDirectory: false, revisionId: 38, checkedOut: false },
    ]);
  });

  it('reads the root as an empty path and a decomposed name (macOS) composed', () => {
    const output = formatOutput(['', 'dir', 3, ''], ['Se\u006e\u0303al.cs', 'bin', 9, '']);

    expect(parseLoadedItems(output)).toEqual([
      { path: '', isDirectory: true, revisionId: 3, checkedOut: false },
      { path: 'Se\u00f1al.cs', isDirectory: false, revisionId: 9, checkedOut: false },
    ]);
  });
});
