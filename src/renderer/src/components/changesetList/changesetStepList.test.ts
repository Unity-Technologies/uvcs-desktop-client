import { describe, expect, it } from 'vitest';
import type { Changeset } from '@shared/domain/changeset';
import { formatDateTime } from '../../lib/formatDate';
import type { SelectionState } from '../../lib/selection';
import {
  ALL_CHANGES_KEY,
  ALL_CHANGES_SELECTION,
  CHANGESET_ROW_HEIGHT,
  changesetFilterPlaceholder,
  changesetListRowKey,
  changesetListRows,
  changesetListSelection,
  changesetRowsHeight,
  changesetRowTip,
  changesetStep,
  filterChangesets,
  focusRevealKey,
  focusSelection,
  oldestFirst,
  selectedChangesetIds,
} from './changesetStepList';

const changeset = (id: number, comment = '', owner = 'ana'): Changeset => ({ id, guid: `guid-${id}`, branch: '/main/task', comment, owner, date: '2026-10-01T10:00:00Z', parent: id - 1, repository: 'game@local' });
const ids = (changesets: readonly Changeset[]): number[] => changesets.map((one) => one.id);
const keys = (selection: SelectionState): string[] => [...selection.selected].sort();

const branch = [
  changeset(280536, 'Include the agent plugin in our repo', 'daniel'),
  changeset(280535, 'Keep the agent plugin marketplace', 'daniel'),
  changeset(280532, 'Walk a ticket from triage to done', 'rosa'),
  changeset(280530, 'Restore CRLF line endings\nin the scripts', 'daniel'),
];

describe('changesetListRows', () => {
  it('stands for every changeset combined on top, then each changeset as given', () => {
    const rows = changesetListRows(oldestFirst(branch), '');
    expect(rows.map(changesetListRowKey)).toEqual([ALL_CHANGES_KEY, '280530', '280532', '280535', '280536']);
  });

  it('leaves the combined row out while words are typed, which match changesets only', () => {
    expect(changesetListRows([branch[0]!], 'plugin').map(changesetListRowKey)).toEqual(['280536']);
    expect(changesetListRows([], 'nothing')).toEqual([]);
  });

  it('keeps the combined row for a filter of blanks', () => {
    expect(changesetListRows([], '  ').map(changesetListRowKey)).toEqual([ALL_CHANGES_KEY]);
  });
});

describe('filterChangesets', () => {
  it('shows every changeset for a blank filter', () => {
    expect(ids(filterChangesets(branch, '  '))).toEqual([280536, 280535, 280532, 280530]);
  });

  it('matches every word of the comment, in any order and case', () => {
    expect(ids(filterChangesets(branch, 'PLUGIN agent'))).toEqual([280536, 280535]);
  });

  it('matches the number and the author', () => {
    expect(ids(filterChangesets(branch, '28053'))).toEqual([280536, 280535, 280532, 280530]);
    expect(ids(filterChangesets(branch, '280532'))).toEqual([280532]);
    expect(ids(filterChangesets(branch, 'rosa'))).toEqual([280532]);
  });

  it('matches the author by the name shown and as stored', () => {
    const changesets = [changeset(9, 'Fix the build', 'jane.doe@unity3d.com'), changeset(8, 'Tidy up', 'rosa')];
    expect(ids(filterChangesets(changesets, 'jane doe'))).toEqual([9]);
    expect(ids(filterChangesets(changesets, 'jane.doe@unity3d'))).toEqual([9]);
  });

  it('matches words across the number, the comment and the author', () => {
    expect(ids(filterChangesets(branch, 'daniel crlf'))).toEqual([280530]);
  });

  it('matches past the first line of a comment, and non-ASCII text', () => {
    expect(ids(filterChangesets(branch, 'scripts'))).toEqual([280530]);
    expect(ids(filterChangesets([changeset(7, 'Añade la cámara', 'josé')], 'CÁMARA josé'))).toEqual([7]);
  });

  it('shows nothing when nothing matches', () => {
    expect(filterChangesets(branch, 'nothing like this')).toEqual([]);
  });
});

describe('changesetListSelection', () => {
  const rowKeys = [ALL_CHANGES_KEY, '10', '11', '12', '13'];

  it('keeps one row selected as it is, the combined one too', () => {
    expect(changesetListSelection({ selected: new Set(['11']), anchor: '11' }, rowKeys)).toEqual({ selected: new Set(['11']), anchor: '11' });
    expect(changesetListSelection(ALL_CHANGES_SELECTION, rowKeys)).toEqual(ALL_CHANGES_SELECTION);
  });

  // Several changesets show as one diff, every one between them in it: the selection says so as one band.
  it('selects every row between changesets selected apart, keeping the anchor', () => {
    const selection = changesetListSelection({ selected: new Set(['10', '13']), anchor: '13' }, rowKeys);
    expect(keys(selection)).toEqual(['10', '11', '12', '13']);
    expect(selection.anchor).toBe('13');
  });

  it('leaves the combined row out of a selection with changesets: Shift-click from it selects up to a changeset', () => {
    const selection = changesetListSelection({ selected: new Set([ALL_CHANGES_KEY, '10', '11']), anchor: ALL_CHANGES_KEY }, rowKeys);
    expect(keys(selection)).toEqual(['10', '11']);
    expect(selection.anchor).toBe('11');
  });

  it('fills the band between the rows shown, the filter hiding the others', () => {
    expect(keys(changesetListSelection({ selected: new Set(['10', '13']), anchor: '10' }, ['10', '13']))).toEqual(['10', '13']);
  });

  it('keeps a selection whose rows went away as it is', () => {
    const gone = { selected: new Set(['98', '99']), anchor: '99' };
    expect(changesetListSelection(gone, rowKeys)).toEqual(gone);
  });
});

describe('selectedChangesetIds', () => {
  it('is the changesets selected', () => {
    expect(selectedChangesetIds({ selected: new Set(['15', '17']), anchor: '17' }).sort()).toEqual([15, 17]);
  });

  // A Cmd/Ctrl-click on a selected row takes it out and leaves it the anchor: the others show, not it.
  it('leaves out the anchor a Cmd/Ctrl-click took out of the selection', () => {
    expect(selectedChangesetIds({ selected: new Set(['15']), anchor: '17' })).toEqual([15]);
  });

  it('is the anchor when nothing is selected, and none without one', () => {
    expect(selectedChangesetIds({ selected: new Set(), anchor: '17' })).toEqual([17]);
    expect(selectedChangesetIds({ selected: new Set(), anchor: null })).toEqual([]);
  });

  it('is none for the combined row, which shows them all', () => {
    expect(selectedChangesetIds(ALL_CHANGES_SELECTION)).toEqual([]);
    expect(selectedChangesetIds({ selected: new Set(), anchor: ALL_CHANGES_KEY })).toEqual([]);
  });
});

describe('changesetStep', () => {
  const listed = oldestFirst(branch);

  it('goes down to the newer changeset and up to the older one', () => {
    expect(changesetStep(listed, listed, 280532, 1)).toBe(280535);
    expect(changesetStep(listed, listed, 280532, -1)).toBe(280530);
  });

  it('stops at either end of the list', () => {
    expect(changesetStep(listed, listed, 280536, 1)).toBeNull();
    expect(changesetStep(listed, listed, 280530, -1)).toBeNull();
  });

  it('skips the changesets the filter hides', () => {
    const shown = [listed[0]!, listed[3]!];
    expect(changesetStep(listed, shown, 280530, 1)).toBe(280536);
    expect(changesetStep(listed, shown, 280536, -1)).toBe(280530);
  });

  it('goes from a selected changeset the filter hides to the nearest shown one on that side', () => {
    const shown = [listed[0]!, listed[3]!];
    expect(changesetStep(listed, shown, 280532, 1)).toBe(280536);
    expect(changesetStep(listed, shown, 280532, -1)).toBe(280530);
    expect(changesetStep(listed, [listed[0]!], 280535, 1)).toBeNull();
  });

  it('goes from the combined row down to the oldest shown changeset, and nowhere up', () => {
    expect(changesetStep(listed, listed.slice(1), null, 1)).toBe(280532);
    expect(changesetStep(listed, listed, null, -1)).toBeNull();
    expect(changesetStep(listed, [], null, 1)).toBeNull();
  });

  it('goes nowhere from a changeset the list no longer has', () => {
    expect(changesetStep(listed, listed, 1, 1)).toBeNull();
  });
});

describe('focusSelection', () => {
  it('selects the combined row, or the changeset asked for', () => {
    expect(focusSelection({ kind: 'all' }, branch)).toEqual(ALL_CHANGES_SELECTION);
    expect(focusSelection({ kind: 'changeset', changesetId: 280532 }, undefined)).toEqual({ selected: new Set(['280532']), anchor: '280532' });
  });

  it('selects every changeset of a span, from the newest', () => {
    const selection = focusSelection({ kind: 'span', span: { oldest: 280532, newest: 280536 } }, branch);
    expect(keys(selection)).toEqual(['280532', '280535', '280536']);
    expect(selection.anchor).toBe('280536');
  });

  it("selects a span's ends while the changesets are read, which show the same diff", () => {
    expect(keys(focusSelection({ kind: 'span', span: { oldest: 280532, newest: 280536 } }, undefined))).toEqual(['280532', '280536']);
  });

  it('selects one changeset for a span of one', () => {
    expect(keys(focusSelection({ kind: 'span', span: { oldest: 280535, newest: 280535 } }, branch))).toEqual(['280535']);
  });
});

describe('focusRevealKey', () => {
  it('brings the row asked for into view, the newest of a span', () => {
    expect(focusRevealKey({ kind: 'all' })).toBe(ALL_CHANGES_KEY);
    expect(focusRevealKey({ kind: 'changeset', changesetId: 7 })).toBe('7');
    expect(focusRevealKey({ kind: 'span', span: { oldest: 5, newest: 8 } })).toBe('8');
  });
});

describe('changesetRowsHeight', () => {
  it('is as tall as the rows, up to the most shown, the rest scrolling', () => {
    expect(changesetRowsHeight(3, { most: 6 })).toBe(3 * CHANGESET_ROW_HEIGHT + 8);
    expect(changesetRowsHeight(400, { most: 6 })).toBe(6 * CHANGESET_ROW_HEIGHT + 8);
  });

  it('keeps room for the fewest rows, a notice or a placeholder where there are none', () => {
    expect(changesetRowsHeight(0, { most: 6 })).toBe(CHANGESET_ROW_HEIGHT + 8);
    expect(changesetRowsHeight(1, { fewest: 4, most: 6 })).toBe(4 * CHANGESET_ROW_HEIGHT + 8);
  });

  it('is its tallest while the changesets are read', () => {
    expect(changesetRowsHeight(undefined, { most: 6 })).toBe(6 * CHANGESET_ROW_HEIGHT + 8);
  });
});

describe('changesetFilterPlaceholder', () => {
  it('counts the changesets once read', () => {
    expect(changesetFilterPlaceholder(undefined)).toBe('Filter changesets');
    expect(changesetFilterPlaceholder(1)).toBe('Filter 1 changeset');
    expect(changesetFilterPlaceholder(1204)).toBe('Filter 1,204 changesets');
  });
});

describe('changesetRowTip', () => {
  it("is the comment's first line, then who, when and which changeset", () => {
    expect(changesetRowTip(changeset(17, 'Fix the jump\n\nIt was too high', 'daniel.garcia@unity3d.com'))).toEqual({
      text: 'Fix the jump',
      sub: `Daniel Garcia · ${formatDateTime('2026-10-01T10:00:00Z')} · cs:17`,
    });
  });

  it('says there is no comment when there is none', () => {
    expect(changesetRowTip(changeset(17, '  ')).text).toBe('No comment');
  });
});

describe('oldestFirst', () => {
  it('lists changesets as they were checked in, oldest on top, leaving the read as it is', () => {
    const read = [changeset(3), changeset(1), changeset(2)];
    expect(ids(oldestFirst(read))).toEqual([1, 2, 3]);
    expect(ids(read)).toEqual([3, 1, 2]);
  });
});
