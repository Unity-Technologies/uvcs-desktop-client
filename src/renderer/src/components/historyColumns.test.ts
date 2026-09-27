import { describe, expect, it } from 'vitest';
import { authorColumn, avatarColumn, commentColumn, dateColumn, numberColumn, secondaryColumn, type HistoryRow } from './historyColumns';

const columns = [
  avatarColumn<HistoryRow>(),
  numberColumn<HistoryRow>('Changeset'),
  commentColumn<HistoryRow>(),
  secondaryColumn<HistoryRow>('branch', 'Branch', { text: () => '', sortValue: () => '' }),
  authorColumn<HistoryRow>(),
  dateColumn<HistoryRow>(),
];

/** What DataTable shows at a list width. */
const shownAt = (width: number): string[] => columns.filter((column) => !column.hideBelow || width >= column.hideBelow).map((column) => column.id);

describe('history columns', () => {
  it('show everything in a wide list', () => {
    expect(shownAt(900)).toEqual(['avatar', 'id', 'comment', 'branch', 'owner', 'date']);
  });

  it('give way as the list narrows, keeping the number and the comment', () => {
    expect(shownAt(600)).toEqual(['avatar', 'id', 'comment', 'branch', 'date']);
    expect(shownAt(500)).toEqual(['avatar', 'id', 'comment', 'date']);
    expect(shownAt(400)).toEqual(['id', 'comment', 'date']);
    expect(shownAt(340)).toEqual(['id', 'comment']);
  });

  it('never ask for more fixed width than the list has, leaving the comment its minimum', () => {
    for (const width of [340, 360, 480, 560, 700]) {
      const fixed = columns
        .filter((column) => !column.hideBelow || width >= column.hideBelow)
        .reduce((sum, column) => sum + (column.width ?? 80), 0);
      expect(fixed).toBeLessThanOrEqual(width);
    }
  });
});
