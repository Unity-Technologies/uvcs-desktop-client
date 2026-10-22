import { describe, expect, it } from 'vitest';
import { countCalls } from '@shared/testing/countCalls';
import type { PendingChange } from '@shared/domain/pendingChanges';
import { bulkPrivateFiles } from './bulkPrivate';
import { isShelvable } from './changeCategories';
import { consistentlyIncluded, indexPending, neededWith } from './checkinDependencies';
import { checkinFactsOf, everyBoxChecked, shownCheckState, shownChecksOf, checkinSelectionOf, includedBy, type CheckinChoice, type ListedChanges } from './checkinSelection';
import { uploadSummary } from './uploadSummary';

/** Changes listed, of which the filter shows `matchingFilter`: all of them when nothing filters. */
const listing = (all: PendingChange[], matchingFilter = all): ListedChanges => ({ all, matchingFilter, index: indexPending(all), facts: checkinFactsOf(all) });

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
    const selection = checkinSelectionOf(listing(all), unchecking(['src/new.ts']));

    expect(selection.included).toEqual([edited, privateFile, link]);
  });

  // Filtered by Changed: the private file stays checked, out of sight, and out of the check-in.
  it('checks in only the checked changes the filter shows, keeping the hidden ones checked for when they show again', () => {
    const selection = checkinSelectionOf(listing(all, [edited, link]), unchecking([]));

    expect(selection.included).toEqual([edited, link]);
    expect(selection.upload.bytes).toBe(101);
    expect(selection.isIncluded(privateFile)).toBe(true);
  });

  // Filtered by name on "file.c", the private folders it needs don't show: they go in with it, as cm needs them.
  it('takes with a shown change the hidden ones it needs, and counts them', () => {
    const foo = { ...change('foo', ['private'], 0), itemType: 'directory' as const };
    const fileC = change('foo/file.c', ['private']);
    const listed = [foo, fileC, edited];

    const selection = checkinSelectionOf(listing(listed, [fileC]), unchecking([]));

    expect(selection.included).toEqual([foo, fileC]);
    expect(selection.hiddenIncludedCount).toBe(1);
  });

  // The added file is unchecked, the ignored and hidden ones are never checked: the private file alone waits.
  it('counts the checked changes the filter hides, for the button to say why it has nothing to take', () => {
    const choice = unchecking(['src/new.ts']);

    expect(checkinSelectionOf(listing(all, [edited, link]), choice).hiddenIncludedCount).toBe(1);
    expect(checkinSelectionOf(listing(all), choice).hiddenIncludedCount).toBe(0);
  });

  // Filtered by Changed over 60 generated private files: none of them goes in, so there is nothing to warn about.
  it('shelves, and warns about many private files, only from what the filter shows', () => {
    const generated = Array.from({ length: 60 }, (_, index) => change(`gen/f${index}.cs`, ['private']));
    const choice = unchecking([]);

    expect(checkinSelectionOf(listing([edited, ...generated]), choice).bulkPrivate?.fileCount).toBe(60);
    expect(checkinSelectionOf(listing([edited, ...generated], [edited]), choice)).toMatchObject({ included: [edited], shelvable: [edited], bulkPrivate: null });
  });

  it('shelves what a shelve can take: no private files, no links', () => {
    const selection = checkinSelectionOf(listing(all), unchecking([]));

    expect(selection.shelvable).toEqual([edited, added]);
    expect(selection.shelvableUpload.bytes).toBe(120);
    expect(selection.upload.bytes).toBe(126);
  });

  it('warns about many private files only when they are included', () => {
    const generated = Array.from({ length: 60 }, (_, index) => change(`gen/f${index}.cs`, ['private']));

    expect(checkinSelectionOf(listing(generated), unchecking([])).bulkPrivate?.fileCount).toBe(60);
    expect(checkinSelectionOf(listing(generated), unchecking(generated.map((item) => item.path))).bulkPrivate).toBeNull();
  });
});

describe('checkinSelectionOf, over many changes', () => {
  const folder = (path: string, kinds: PendingChange['kinds']): PendingChange => change(path, kinds, 0, 'directory');
  // Nested private folders, a moved folder, a deleted folder a move leaves, a merge, edits, links and ignored files.
  const many = [
    folder('gen', ['private']),
    folder('gen/obj', ['private']),
    folder('moved', ['moved']),
    { ...folder('old', ['deleted']) },
    { ...change('kept/b.ts', ['moved'], 3), oldPath: 'old/b.ts' },
    { ...change('m/merged.ts', ['replaced'], 4), mergeInfo: 'Merge from 5' },
    { ...change('m/merged2.ts', ['changed'], 4), mergeInfo: 'Merge from 5' },
    ...Array.from({ length: 3_000 }, (_, index): PendingChange => {
      if (index % 5 === 0) return change(`src/f${index % 40}/edit${index}.ts`, ['checkedOut', 'changed'], index);
      if (index % 7 === 0) return change(`src/link${index}`, ['changed'], 1, 'symlink');
      if (index % 11 === 0) return change(`build/out${index}.bin`, ['ignored'], index);
      if (index % 13 === 0) return change(`moved/in${index}.ts`, ['changed'], index);
      return change(`${index % 3 ? 'gen' : 'gen/obj'}/sub${index % 20}/p${index}.g`, ['private'], index);
    }),
  ];
  const edits = many.filter((item) => item.kinds.includes('changed'));

  /** The selection worked out the plain way, change by change, as the check-in rules say. */
  function plainly({ all, matchingFilter, index }: ListedChanges, isIncluded: (change: PendingChange) => boolean) {
    const shown = matchingFilter.filter(isIncluded);
    const going = new Set(neededWith(shown, index).filter(isIncluded));
    const included = matchingFilter === all ? all.filter(isIncluded) : all.filter((item) => going.has(item));
    const shelvable = included.filter(isShelvable);
    return {
      included,
      hiddenIncludedCount: all.filter(isIncluded).length - included.length,
      shownIncludedCount: shown.length,
      upload: uploadSummary(included),
      shelvable,
      shelvableUpload: uploadSummary(shelvable),
      bulkPrivate: bulkPrivateFiles(included),
    };
  }

  const choices: [string, CheckinChoice][] = [
    ['everything checked', unchecking([])],
    ['a few files unchecked', unchecking(['src/f0/edit0.ts', 'gen/sub1/p1.g', 'src/link7'])],
    ['a private folder unchecked', unchecking(['gen/obj'])],
    ['a moved folder unchecked', unchecking(['moved'])],
    ['the move a deleted folder waits for unchecked', unchecking(['kept/b.ts'])],
    ['a merge change unchecked', unchecking(['m/merged.ts'])],
    ['a changelist prepared', { excludedPaths: new Set<string>(), prepared: { name: 'ui', paths: new Set(['src/f5/edit5.ts', 'gen/sub2/p2.g', 'gen']) } }],
  ];

  it.each(choices.flatMap(([name, choice]) => [[`${name}, nothing filtered`, many, choice] as const, [`${name}, filtered by Changed`, edits, choice] as const]))(
    'takes what going over every change takes: %s',
    (_, matchingFilter, choice) => {
      const listed = listing(many, matchingFilter);
      const { isIncluded: _isIncluded, everyCandidateIncluded: _every, ...selection } = checkinSelectionOf(listed, choice);
      expect(selection).toEqual(plainly(listed, consistentlyIncluded(includedBy(choice), listed.index)));
    },
  );

  it("asks only the merge's boxes while every box is checked and nothing filtered, and a few each when one is unchecked", () => {
    const listed = listing(many);
    const everything = countCalls(Set.prototype, 'has', () => checkinSelectionOf(listed, unchecking([])));
    // Only whether the pending merge's two changes are checked (`consistentlyIncluded` asks it once a click).
    expect(everything.calls).toBe(2);
    expect(everything.result.everyCandidateIncluded).toBe(true);

    const oneUnchecked = countCalls(Set.prototype, 'has', () => checkinSelectionOf(listed, unchecking(['src/f0/edit0.ts'])));
    expect(oneUnchecked.result.everyCandidateIncluded).toBe(false);
    expect(oneUnchecked.calls).toBeGreaterThan(0);
    expect(oneUnchecked.calls).toBeLessThan(3 * many.length);
  });
});

describe('shownChecksOf', () => {
  it("takes the count the selection made of what the filter shows, and counts again what review mode narrows it to", () => {
    const listed = listing(all, [edited, added, link]);
    const selection = checkinSelectionOf(listed, unchecking(['src/new.ts']));
    let asked = 0;
    const counting = { ...selection, isIncluded: (item: PendingChange) => (asked++, selection.isIncluded(item)) };

    const shown = shownChecksOf([edited, added, link], listed.matchingFilter, listed.matchingFilter, counting);
    expect(shown).toMatchObject({ checked: 2 });
    expect(shownCheckState(shown)).toBe('mixed');
    expect(asked).toBe(0);
    expect(shownChecksOf([edited, added], [edited, added], listed.matchingFilter, counting).checked).toBe(1);
  });

  it('lets a row ask nothing while every box is checked and nothing filtered', () => {
    const listed = listing(all);
    expect(shownChecksOf([edited], all, all, checkinSelectionOf(listed, unchecking([]))).isChosen).toBeNull();
    expect(shownChecksOf([edited], all, all, checkinSelectionOf(listed, unchecking(['src/a.ts']))).isChosen).not.toBeNull();
    expect(shownCheckState({ candidates: [edited], checked: 1, isChosen: null })).toBe(true);
  });
});

describe('everyBoxChecked', () => {
  it('reads every box checked once what the user unchecked is no longer pending (undone, checked in), or never goes in', () => {
    const index = indexPending(all);

    expect(everyBoxChecked(unchecking([]), index)).toBe(true);
    expect(everyBoxChecked(unchecking(['src/a.ts']), index)).toBe(false);
    expect(everyBoxChecked(unchecking(['src/gone.ts', 'build/out.bin']), index)).toBe(true);
    expect(everyBoxChecked({ excludedPaths: new Set(), prepared: { name: 'ui', paths: new Set() } }, index)).toBe(false);
  });
});
