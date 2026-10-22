import { describe, expect, it } from 'vitest';
import type { PendingChange } from '@shared/domain/pendingChanges';
import { indexPending } from './checkinDependencies';
import { checkinSelectionOf, includedBy, type CheckinChoice, type ListedChanges } from './checkinSelection';

/** Changes listed, of which the filter shows `matchingFilter`: all of them when nothing filters. */
const listing = (all: PendingChange[], matchingFilter = all): ListedChanges => ({ all, matchingFilter, index: indexPending(all) });

/** The choice of a user who unchecked `paths`. */
const unchecking = (paths: string[]): CheckinChoice => ({ excludedPaths: new Set(paths), prepared: null });

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
    expect(all.filter(includedBy(unchecking([])))).toEqual([edited, added, privateFile, link]);
  });

  it('leaves out the changes whose box was unchecked', () => {
    expect(all.filter(includedBy(unchecking(['src/a.ts', 'notes.txt'])))).toEqual([added, link]);
  });
});

describe('checkinSelectionOf', () => {
  it('checks in the checked changes, but those the user unchecked', () => {
    const selection = checkinSelectionOf(listing(all), includedBy(unchecking(['src/new.ts'])));

    expect(selection.included).toEqual([edited, privateFile, link]);
  });

  // Filtered by Changed: the private file stays checked, out of sight, and out of the check-in.
  it('checks in only the checked changes the filter shows, keeping the hidden ones checked for when they show again', () => {
    const isIncluded = includedBy(unchecking([]));
    const selection = checkinSelectionOf(listing(all, [edited, link]), isIncluded);

    expect(selection.included).toEqual([edited, link]);
    expect(selection.upload.bytes).toBe(101);
    expect(isIncluded(privateFile)).toBe(true);
  });

  // Filtered by name on "file.c", the private folders it needs don't show: they go in with it, as cm needs them.
  it('takes with a shown change the hidden ones it needs, and counts them', () => {
    const foo = { ...change('foo', ['private'], 0), itemType: 'directory' as const };
    const fileC = change('foo/file.c', ['private']);
    const listed = [foo, fileC, edited];

    const selection = checkinSelectionOf(listing(listed, [fileC]), includedBy(unchecking([])));

    expect(selection.included).toEqual([foo, fileC]);
    expect(selection.hiddenIncludedCount).toBe(1);
  });

  // The added file is unchecked, the ignored and hidden ones are never checked: the private file alone waits.
  it('counts the checked changes the filter hides, for the button to say why it has nothing to take', () => {
    const isIncluded = includedBy(unchecking(['src/new.ts']));

    expect(checkinSelectionOf(listing(all, [edited, link]), isIncluded).hiddenIncludedCount).toBe(1);
    expect(checkinSelectionOf(listing(all), isIncluded).hiddenIncludedCount).toBe(0);
  });

  // Filtered by Changed over 60 generated private files: none of them goes in, so there is nothing to warn about.
  it('shelves, and warns about many private files, only from what the filter shows', () => {
    const generated = Array.from({ length: 60 }, (_, index) => change(`gen/f${index}.cs`, ['private']));
    const isIncluded = includedBy(unchecking([]));

    expect(checkinSelectionOf(listing([edited, ...generated]), isIncluded).bulkPrivate?.fileCount).toBe(60);
    expect(checkinSelectionOf(listing([edited, ...generated], [edited]), isIncluded)).toMatchObject({ included: [edited], shelvable: [edited], bulkPrivate: null });
  });

  it('shelves what a shelve can take: no private files, no links', () => {
    const selection = checkinSelectionOf(listing(all), includedBy(unchecking([])));

    expect(selection.shelvable).toEqual([edited, added]);
    expect(selection.shelvableUpload.bytes).toBe(120);
    expect(selection.upload.bytes).toBe(126);
  });

  it('warns about many private files only when they are included', () => {
    const generated = Array.from({ length: 60 }, (_, index) => change(`gen/f${index}.cs`, ['private']));

    expect(checkinSelectionOf(listing(generated), includedBy(unchecking([]))).bulkPrivate?.fileCount).toBe(60);
    expect(checkinSelectionOf(listing(generated), includedBy(unchecking(generated.map((item) => item.path)))).bulkPrivate).toBeNull();
  });
});
