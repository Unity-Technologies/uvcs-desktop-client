import { describe, expect, it } from 'vitest';
import type { PendingChange } from '@shared/domain/pendingChanges';
import { countCalls } from '@shared/testing/countCalls';
import { bulkPrivateFiles } from './bulkPrivate';
import { checkinCandidatesOf, checkinSelectionOf, includedBy, shownIncludedCount, type CheckinChoice } from './checkinSelection';
import { uploadSummary } from './uploadSummary';

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
  it('checks in every included change, whatever the filter shows: the filter only narrows the list', () => {
    const selection = checkinSelectionOf(checkinCandidatesOf(all), unchecking(['src/new.ts']));

    expect(selection.included).toEqual([edited, privateFile, link]);
  });

  it('shelves what a shelve can take: no private files, no links', () => {
    const selection = checkinSelectionOf(checkinCandidatesOf(all), unchecking([]));

    expect(selection.shelvable).toEqual([edited, added]);
    expect(selection.shelvableUpload.bytes).toBe(120);
    expect(selection.upload.bytes).toBe(126);
  });

  it('warns about many private files only when they are included', () => {
    const generated = Array.from({ length: 60 }, (_, index) => change(`gen/f${index}.cs`, ['private']));

    expect(checkinSelectionOf(checkinCandidatesOf(generated), unchecking([])).bulkPrivate?.fileCount).toBe(60);
    expect(checkinSelectionOf(checkinCandidatesOf(generated), unchecking(generated.map((item) => item.path))).bulkPrivate).toBeNull();
  });
});

describe('checkinSelectionOf, over many changes', () => {
  // Private folders holding private files, edits, links and ignored files, as a big read brings them.
  const many = [
    change('gen', ['private'], 0, 'directory'),
    change('gen/obj', ['private'], 0, 'directory'),
    ...Array.from({ length: 3_000 }, (_, index): PendingChange => {
      if (index % 5 === 0) return change(`src/f${index % 40}/edit${index}.ts`, ['checkedOut', 'changed'], index);
      if (index % 7 === 0) return change(`src/link${index}`, ['changed'], 1, 'symlink');
      if (index % 11 === 0) return change(`build/out${index}.bin`, ['ignored'], index);
      return change(`${index % 3 ? 'gen' : 'gen/obj'}/sub${index % 20}/p${index}.g`, ['private'], index);
    }),
  ];
  const candidates = checkinCandidatesOf(many);

  /** What the selection is, worked out the plain way, change by change. */
  function plainly(choice: CheckinChoice) {
    const included = many.filter(includedBy(choice));
    const shelvable = included.filter((item) => item.itemType !== 'symlink' && !item.kinds.includes('private'));
    return { included, upload: uploadSummary(included), shelvable, shelvableUpload: uploadSummary(shelvable), bulkPrivate: bulkPrivateFiles(included) };
  }

  it.each([
    ['everything checked', unchecking([])],
    ['a few files unchecked', unchecking(['src/f0/edit0.ts', 'gen/sub1/p1.g', 'src/link7'])],
    ['a private folder unchecked, its files still in', unchecking(['gen/obj'])],
    ['every private file unchecked', unchecking(many.filter((item) => item.kinds.includes('private')).map((item) => item.path))],
    ['a changelist prepared', { excludedPaths: new Set<string>(), prepared: { name: 'ui', paths: new Set(['src/f5/edit5.ts', 'gen/sub2/p2.g']) } }],
  ])('takes what going over every change takes: %s', (_, choice) => {
    const { isIncluded: _isIncluded, isChosen: _isChosen, ...selection } = checkinSelectionOf(candidates, choice);
    expect(selection).toEqual(plainly(choice));
  });

  it("finds a click's selection with one look at the box of each candidate, and none while every box is checked", () => {
    const choice = unchecking(['src/f0/edit0.ts']);
    const { calls } = countCalls(Set.prototype, 'has', () => checkinSelectionOf(candidates, choice));
    expect(calls).toBe(candidates.changes.length);
    expect(countCalls(Set.prototype, 'has', () => checkinSelectionOf(candidates, unchecking([]))).calls).toBe(0);
  });
});

describe('shownIncludedCount', () => {
  it('counts the checked changes among those shown, without going over them when every change is shown', () => {
    const selection = checkinSelectionOf(checkinCandidatesOf(all), unchecking(['src/new.ts']));

    expect(shownIncludedCount(all, all.length, selection)).toBe(3);
    expect(shownIncludedCount([edited, added, ignored], all.length, selection)).toBe(1);
  });
});
