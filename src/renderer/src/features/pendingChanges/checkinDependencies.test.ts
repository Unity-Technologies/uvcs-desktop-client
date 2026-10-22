import { describe, expect, it } from 'vitest';
import type { PendingChange } from '@shared/domain/pendingChanges';
import { countCalls } from '@shared/testing/countCalls';
import { consistentlyIncluded, indexPending, neededWith, needingThem } from './checkinDependencies';

const file = (path: string, kinds: PendingChange['kinds'], oldPath?: string): PendingChange => ({ path, kinds, itemType: 'file', size: 1, lastModified: '', ...(oldPath && { oldPath }) });
const folder = (path: string, kinds: PendingChange['kinds'], oldPath?: string): PendingChange => ({ path, kinds, itemType: 'directory', size: 0, lastModified: '', ...(oldPath && { oldPath }) });
const paths = (changes: PendingChange[]): string[] => changes.map((change) => change.path).sort();

// Each case is one cm refuses, or takes more than asked, when what it depends on isn't given (measured on a sandbox).
const foo = folder('foo', ['private']);
const bar = folder('foo/bar', ['private']);
const fileC = file('foo/bar/file.c', ['private']);
const other = file('foo/other.c', ['private']);
const lib = folder('lib', ['moved'], 'src');
const b = file('lib/b.cs', ['changed']);
const c = file('lib/c.cs', ['changed']);
const p = file('lib/p.txt', ['private']);
const xlink = folder('devops', ['checkedOut']);
const inXlink = file('devops/Build.cs', ['checkedOut', 'changed']);
const pending = [foo, bar, fileC, other, lib, b, c, p, xlink, inXlink];
const index = indexPending(pending);

describe('neededWith', () => {
  it('checks the private folders a private file is in: cm refuses the file without them', () => {
    expect(paths(neededWith([fileC], index))).toEqual(['foo', 'foo/bar', 'foo/bar/file.c']);
  });

  it('checks nothing more for a file in a checked-out folder or xlink: cm takes the checkout along', () => {
    expect(paths(neededWith([inXlink], index))).toEqual(['devops/Build.cs']);
  });

  it('checks the added folder a file is in', () => {
    const assets = folder('assets', ['added']);
    const icon = file('assets/icon.png', ['added']);

    expect(paths(neededWith([icon], indexPending([assets, icon])))).toEqual(['assets', 'assets/icon.png']);
  });

  // cm refuses lib/b.cs without the move, and takes everything in lib with it.
  it('checks the moved folder a file is in, and everything in it but private files', () => {
    expect(paths(neededWith([b], index))).toEqual(['lib', 'lib/b.cs', 'lib/c.cs']);
    expect(paths(neededWith([lib], index))).toEqual(['lib', 'lib/b.cs', 'lib/c.cs']);
  });

  it('checks the move away from where an added file now is', () => {
    const movedAway = file('docs/old.md', ['moved'], 'readme.md');
    const addedThere = file('readme.md', ['added']);

    expect(paths(neededWith([addedThere], indexPending([movedAway, addedThere])))).toEqual(['docs/old.md', 'readme.md']);
  });

  it('checks the moves out of a deleted folder', () => {
    const gone = folder('old', ['deleted']);
    const kept = file('keep/a.cs', ['moved'], 'old/a.cs');
    const movedWithin = file('old/b.cs', ['moved'], 'old/c.cs');

    expect(paths(neededWith([gone], indexPending([gone, kept, movedWithin])))).toEqual(['keep/a.cs', 'old']);
  });
});

describe('nested folders', () => {
  const outer = folder('lib', ['moved'], 'src');
  const inner = folder('lib/core', ['moved'], 'lib/base');
  const deep = file('lib/core/a.cs', ['changed']);
  const nested = indexPending([outer, inner, deep]);

  it('checks and unchecks every moved folder above, and all they hold', () => {
    expect(paths(neededWith([deep], nested))).toEqual(['lib', 'lib/core', 'lib/core/a.cs']);
    expect(paths(needingThem([deep], nested))).toEqual(['lib', 'lib/core', 'lib/core/a.cs']);
  });

  it('unchecks only the file in an added folder: the folder can go in without it', () => {
    const assets = folder('assets', ['added']);
    const icon = file('assets/icon.png', ['added']);

    expect(paths(needingThem([icon], indexPending([assets, icon])))).toEqual(['assets/icon.png']);
  });
});

describe('needingThem', () => {
  it('unchecks what a private folder holds, at any depth', () => {
    expect(paths(needingThem([foo], index))).toEqual(['foo', 'foo/bar', 'foo/bar/file.c', 'foo/other.c']);
  });

  // A moved folder goes in whole or not at all.
  it('unchecks the moved folder and all it holds when a file in it is unchecked', () => {
    expect(paths(needingThem([c], index))).toEqual(['lib', 'lib/b.cs', 'lib/c.cs', 'lib/p.txt']);
  });

  it('leaves the moved folder checked when a private file in it is unchecked: it goes in only when checked', () => {
    expect(paths(needingThem([p], index))).toEqual(['lib/p.txt']);
  });

  it('unchecks nothing more for a file in a checked-out folder', () => {
    expect(paths(needingThem([inXlink], index))).toEqual(['devops/Build.cs']);
  });

  it('unchecks the file added where a move left, and the deleted folder a move leaves', () => {
    const movedAway = file('docs/old.md', ['moved'], 'readme.md');
    const addedThere = file('readme.md', ['added']);
    const gone = folder('old', ['deleted']);
    const kept = file('keep/a.cs', ['moved'], 'old/a.cs');
    const both = indexPending([movedAway, addedThere, gone, kept]);

    expect(paths(needingThem([movedAway], both))).toEqual(['docs/old.md', 'readme.md']);
    expect(paths(needingThem([kept], both))).toEqual(['keep/a.cs', 'old']);
  });
});

describe('consistentlyIncluded', () => {
  it('leaves out a change whose private folder is unchecked, as a file that appears in a folder left out', () => {
    const unchecked = new Set(['foo']);
    const isIncluded = consistentlyIncluded((change) => !unchecked.has(change.path), index);

    expect(pending.filter(isIncluded)).toEqual([lib, b, c, p, xlink, inXlink]);
  });

  // New changes are checked by default: one cm would refuse without what the user unchecked stays out.
  it('leaves out an item added where a move left, and a deleted folder, while the move is unchecked', () => {
    const movedAway = file('docs/old.md', ['moved'], 'readme.md');
    const addedThere = file('readme.md', ['private']);
    const gone = folder('old', ['deleted']);
    const movedOut = file('keep/a.cs', ['moved'], 'old/a.cs');
    const unchecked = new Set(['docs/old.md', 'keep/a.cs']);
    const isIncluded = consistentlyIncluded((change) => !unchecked.has(change.path), indexPending([movedAway, addedThere, gone, movedOut]));

    expect([movedAway, addedThere, gone, movedOut].filter(isIncluded)).toEqual([]);
  });

  // cm mv src lib, lib unchecked, then a new src/ appears: the folder and what it holds wait for the move.
  it('leaves out what a folder waiting for its move holds', () => {
    const movedAway = folder('lib', ['moved'], 'src');
    const newFolder = folder('src', ['private']);
    const inNewFolder = file('src/a.cs', ['private']);
    const isIncluded = consistentlyIncluded((change) => change !== movedAway, indexPending([movedAway, newFolder, inNewFolder]));

    expect([movedAway, newFolder, inNewFolder].filter(isIncluded)).toEqual([]);
  });

  it('takes a change in a checked moved folder even unchecked, as a file that appears in it, but no private file', () => {
    const checked = new Set(['lib']);
    const isIncluded = consistentlyIncluded((change) => checked.has(change.path), index);

    expect([lib, b, c, p].filter(isIncluded)).toEqual([lib, b, c]);
  });
});

// cm refuses part of a merge: "All merge changes must be checked in together".
describe('a pending merge', () => {
  const merged = (change: PendingChange): PendingChange => ({ ...change, mergeInfo: 'Merge from 2' });
  const replaced = merged(file('src/a.cs', ['replaced']));
  const copiedFolder = merged(folder('src/feature', ['copied']));
  const copied = merged(file('src/feature/f.cs', ['copied']));
  const mine = file('notes.txt', ['changed']);
  const merging = indexPending([replaced, copiedFolder, copied, mine]);

  it('checks and unchecks all its changes together, and nothing else', () => {
    expect(paths(neededWith([copied], merging))).toEqual(['src/a.cs', 'src/feature', 'src/feature/f.cs']);
    expect(paths(needingThem([replaced], merging))).toEqual(['src/a.cs', 'src/feature', 'src/feature/f.cs']);
  });

  it('leaves it all out when any of its changes is unchecked', () => {
    const isIncluded = consistentlyIncluded((change) => change.path !== 'src/a.cs', merging);

    expect([replaced, copiedFolder, copied, mine].filter(isIncluded)).toEqual([mine]);
  });
});

// Checking a box in a list of tens of thousands must not walk the list: only the folders above what was clicked.
describe('on a big list', () => {
  const big = Array.from({ length: 20_000 }, (_, at) => file(`game/assets/level${at % 50}/props/item${at}.prefab`, ['checkedOut', 'changed']));
  const bigIndex = indexPending([folder('game', ['checkedOut']), ...big]);

  it('checks or unchecks a file looking up only the folders above it', () => {
    const { calls } = countCalls(Map.prototype, 'get', () => {
      neededWith([big[123]!], bigIndex);
      needingThem([big[123]!], bigIndex);
    });

    expect(calls).toBeLessThan(20);
  });

  it('reads every check with a few lookups per change, not per pair of changes', () => {
    const isIncluded = consistentlyIncluded(() => true, bigIndex);

    const { calls } = countCalls(Map.prototype, 'get', () => big.filter(isIncluded));

    expect(calls).toBeLessThanOrEqual(big.length * 5);
  });

  it('checks a merge of 20,000 changes walking it once', () => {
    const merged = big.map((change) => ({ ...change, mergeInfo: 'Merge from 2' }));
    const mergeIndex = indexPending(merged);

    const { result, calls } = countCalls(Map.prototype, 'has', () => [neededWith([merged[0]!], mergeIndex), needingThem([merged[0]!], mergeIndex)]);

    expect(result.map((reached) => reached.length)).toEqual([20_000, 20_000]);
    expect(calls).toBeLessThanOrEqual(merged.length * 2 * 2);
  });

  it('checks 500 deleted folders with 20,000 moves out of them looking up only their own moves', () => {
    const deleted = Array.from({ length: 500 }, (_, at) => folder(`old${at}`, ['deleted']));
    const moves = Array.from({ length: 20_000 }, (_, at) => file(`new/item${at}.cs`, ['moved'], `old${at % 500}/item${at}.cs`));
    const movesIndex = indexPending([...deleted, ...moves]);

    const { result, calls } = countCalls(String.prototype, 'startsWith', () => neededWith(deleted, movesIndex));

    expect(result).toHaveLength(20_500);
    expect(calls).toBeLessThanOrEqual(20_500);
  });

  it('indexes the list in one pass', () => {
    const { calls } = countCalls(Map.prototype, 'get', () => indexPending(big));

    expect(calls).toBeLessThanOrEqual(big.length * 5);
  });
});
