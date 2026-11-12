import { describe, expect, it } from 'vitest';
import type { Changeset } from '@shared/domain/changeset';
import { branchDiffShownFor, branchStartOfChangesets, changesetFilterPlaceholder, changesetStep, filterBranchChangesets, shownBranchChangesets, spanSelection, showsChangesetList } from './changesetByChangeset';

const changeset = (id: number, comment = '', owner = 'ana'): Changeset => ({ id, guid: `guid-${id}`, branch: '/main/task', comment, owner, date: '2026-10-01T10:00:00Z', parent: id - 1, repository: 'game@local' });
const ids = (changesets: readonly Changeset[]): number[] => changesets.map((one) => one.id);

const branch = [
  changeset(280536, 'Include the agent plugin in our repo', 'daniel'),
  changeset(280535, 'Keep the agent plugin marketplace', 'daniel'),
  changeset(280532, 'Walk a ticket from triage to done', 'rosa'),
  changeset(280530, 'Restore CRLF line endings\nin the scripts', 'daniel'),
];

describe('filterBranchChangesets', () => {
  it('shows every changeset for a blank filter', () => {
    expect(ids(filterBranchChangesets(branch, '  '))).toEqual([280536, 280535, 280532, 280530]);
  });

  it('matches every word of the comment, in any order and case', () => {
    expect(ids(filterBranchChangesets(branch, 'PLUGIN agent'))).toEqual([280536, 280535]);
  });

  it('matches the number and the author', () => {
    expect(ids(filterBranchChangesets(branch, '28053'))).toEqual([280536, 280535, 280532, 280530]);
    expect(ids(filterBranchChangesets(branch, '280532'))).toEqual([280532]);
    expect(ids(filterBranchChangesets(branch, 'rosa'))).toEqual([280532]);
  });

  it('matches the author by the name shown and as stored', () => {
    const changesets = [changeset(9, 'Fix the build', 'jane.doe@unity3d.com'), changeset(8, 'Tidy up', 'rosa')];
    expect(ids(filterBranchChangesets(changesets, 'jane doe'))).toEqual([9]);
    expect(ids(filterBranchChangesets(changesets, 'jane.doe@unity3d'))).toEqual([9]);
  });

  it('matches words across the number, the comment and the author', () => {
    expect(ids(filterBranchChangesets(branch, 'daniel crlf'))).toEqual([280530]);
  });

  it('matches past the first line of a comment, and non-ASCII text', () => {
    expect(ids(filterBranchChangesets(branch, 'scripts'))).toEqual([280530]);
    expect(ids(filterBranchChangesets([changeset(7, 'Añade la cámara', 'josé')], 'CÁMARA josé'))).toEqual([7]);
  });

  it('shows nothing when nothing matches', () => {
    expect(filterBranchChangesets(branch, 'nothing like this')).toEqual([]);
  });
});

describe('shownBranchChangesets', () => {
  const reviewedUpTo = { date: '2026-10-01T10:00:00Z', changesetId: 280532 };

  it('keeps only the changesets new since the review while New is on', () => {
    expect(ids(shownBranchChangesets(branch, { query: '', onlyNew: true }, reviewedUpTo))).toEqual([280536, 280535]);
    expect(ids(shownBranchChangesets(branch, { query: '', onlyNew: false }, reviewedUpTo))).toEqual([280536, 280535, 280532, 280530]);
  });

  it('filters the new ones by the words typed', () => {
    expect(ids(shownBranchChangesets(branch, { query: 'marketplace', onlyNew: true }, reviewedUpTo))).toEqual([280535]);
    expect(ids(shownBranchChangesets(branch, { query: 'crlf', onlyNew: true }, reviewedUpTo))).toEqual([]);
  });

  // New shows only while there are new changesets: once none is (the user reviewed again), it keeps nothing out.
  it('shows every changeset when none is new, or before the user reviewed', () => {
    expect(ids(shownBranchChangesets(branch, { query: '', onlyNew: true }, { date: '2026-10-02T10:00:00Z', changesetId: 280536 }))).toEqual([280536, 280535, 280532, 280530]);
    expect(ids(shownBranchChangesets(branch, { query: '', onlyNew: true }, undefined))).toEqual([280536, 280535, 280532, 280530]);
  });
});

describe('changesetStep', () => {
  it('goes down to the older changeset and up to the newer one', () => {
    expect(changesetStep(branch, branch, 280535, 1)).toBe(280532);
    expect(changesetStep(branch, branch, 280535, -1)).toBe(280536);
  });

  it('stops at either end of the list', () => {
    expect(changesetStep(branch, branch, 280530, 1)).toBeNull();
    expect(changesetStep(branch, branch, 280536, -1)).toBeNull();
  });

  it('skips the changesets the filter hides', () => {
    const shown = [branch[0]!, branch[3]!];
    expect(changesetStep(branch, shown, 280536, 1)).toBe(280530);
    expect(changesetStep(branch, shown, 280530, -1)).toBe(280536);
  });

  it('goes from a selected changeset the filter hides to the nearest shown one on that side', () => {
    const shown = [branch[0]!, branch[3]!];
    expect(changesetStep(branch, shown, 280535, 1)).toBe(280530);
    expect(changesetStep(branch, shown, 280535, -1)).toBe(280536);
    expect(changesetStep(branch, [branch[0]!], 280532, 1)).toBeNull();
  });

  it('goes to the first shown changeset when none is selected', () => {
    expect(changesetStep(branch, branch.slice(2), null, 1)).toBe(280532);
    expect(changesetStep(branch, [], null, 1)).toBeNull();
  });

  it('goes nowhere from a changeset the branch no longer has', () => {
    expect(changesetStep(branch, branch, 1, 1)).toBeNull();
  });
});

describe('showsChangesetList', () => {
  it('shows while the changesets are read, and when there are several', () => {
    expect(showsChangesetList(undefined)).toBe(true);
    expect(showsChangesetList(branch)).toBe(true);
  });

  it("doesn't show for a branch with one changeset, or none", () => {
    expect(showsChangesetList([branch[0]!])).toBe(false);
    expect(showsChangesetList([])).toBe(false);
  });
});

describe('changesetFilterPlaceholder', () => {
  it('counts the changesets once read', () => {
    expect(changesetFilterPlaceholder(undefined)).toBe('Filter changesets');
    expect(changesetFilterPlaceholder(1)).toBe('Filter 1 changeset');
    expect(changesetFilterPlaceholder(1204)).toBe('Filter 1,204 changesets');
  });
});

describe('branchStartOfChangesets', () => {
  it("is the oldest changeset and its parent, the list being the whole branch, newest first", () => {
    expect(branchStartOfChangesets('/main/task', branch)).toEqual({ firstChangeset: 280530, base: 280529 });
  });

  it("isn't known while the changesets are read, nor for a branch with none", () => {
    expect(branchStartOfChangesets('/main/task', undefined)).toBeNull();
    expect(branchStartOfChangesets('/main/task', [])).toBeNull();
  });

  // The list keeps the previous branch's changesets while the next branch's are read.
  it("isn't known from another branch's changesets", () => {
    expect(branchStartOfChangesets('/main/other', branch)).toBeNull();
  });
});

describe('branchDiffShownFor', () => {
  it('switches to the changeset asked for, the how-many-th time it is asked, or to the whole branch', () => {
    expect(branchDiffShownFor({ changesetId: 5, seq: 3 })).toEqual({ mode: 'byChangeset', changeset: { changesetId: 5, seq: 3 } });
    expect(branchDiffShownFor({ changesetId: null, seq: 4 })).toEqual({ mode: 'wholeBranch' });
  });

  it('leaves the mode as it is when the request names none, or there is none', () => {
    expect(branchDiffShownFor({ seq: 4 })).toBeNull();
    expect(branchDiffShownFor(null)).toBeNull();
  });
});

describe('spanSelection', () => {
  const keys = (selection: { selected: ReadonlySet<string> }): string[] => [...selection.selected].sort();

  it('selects every changeset of the span, from the newest', () => {
    const selection = spanSelection(branch, { oldest: 280532, newest: 280536 });
    expect(keys(selection)).toEqual(['280532', '280535', '280536']);
    expect(selection.anchor).toBe('280536');
  });

  it('selects the ends while the changesets are read, which show the same diff', () => {
    const selection = spanSelection(undefined, { oldest: 280532, newest: 280536 });
    expect(keys(selection)).toEqual(['280532', '280536']);
    expect(selection.anchor).toBe('280536');
  });

  it('selects one changeset for a span of one', () => {
    expect(keys(spanSelection(branch, { oldest: 280535, newest: 280535 }))).toEqual(['280535']);
  });
});
