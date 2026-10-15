import { describe, expect, it, vi } from 'vitest';
import { compareSortValues } from '../../lib/naturalCompare';
import { ColumnSorter, sortRows } from './sortRows';

vi.mock('../../lib/naturalCompare', async (original) => {
  const actual = await original<typeof import('../../lib/naturalCompare')>();
  return { ...actual, compareSortValues: vi.fn(actual.compareSortValues) };
});

const byName = (row: { name: string }): string => row.name;
const rows = ['task-10', 'Beta', 'task-2', 'alpha', 'beta'].map((name, order) => ({ name, order }));

describe('sortRows', () => {
  it('orders text as people read it and keeps equal values in their order, either way', () => {
    expect(sortRows(rows, byName, false).rows.map((row) => row.name)).toEqual(['alpha', 'Beta', 'beta', 'task-2', 'task-10']);
    expect(sortRows(rows, byName, true).rows.map((row) => row.name)).toEqual(['task-10', 'task-2', 'Beta', 'beta', 'alpha']);
  });

  it('orders numbers by value', () => {
    const numbers = [10, 2, 33].map((id) => ({ id }));
    expect(sortRows(numbers, (row) => row.id, false).rows.map((row) => row.id)).toEqual([2, 10, 33]);
  });

  it('sorts a filtered list with the ranks of the whole one, the same as sorting it afresh', () => {
    const { ranks } = sortRows(rows, byName, false);
    const filtered = rows.filter((row) => row.name !== 'alpha');
    const again = sortRows(filtered, byName, true, ranks);
    expect(again.ranks).toBe(ranks);
    expect(again.rows).toEqual(sortRows(filtered, byName, true).rows);
  });

  it('ranks again when a value is new to the ranks (a refreshed or renamed row)', () => {
    const { ranks } = sortRows(rows.slice(0, 2), byName, false);
    const sorted = sortRows(rows, byName, false, ranks);
    expect(sorted.ranks).not.toBe(ranks);
    expect(sorted.rows.map((row) => row.name)).toEqual(['alpha', 'Beta', 'beta', 'task-2', 'task-10']);
  });

  // Not a single comparison, whatever the size: a few thousand rows show it. The mock records every comparison of the
  // first sort, which made 100,000 rows take seconds on CI's runners.
  it('re-sorts thousands of filtered rows without comparing their text', () => {
    const many = Array.from({ length: 5_000 }, (_, index) => ({ name: `/main/task-${(index * 7919) % 5_000}` }));
    const { ranks } = sortRows(many, byName, false);
    vi.mocked(compareSortValues).mockClear();
    const sorted = sortRows(many.filter((_, index) => index % 2 === 0), byName, true, ranks);
    expect(compareSortValues).not.toHaveBeenCalled();
    expect(sorted.rows[0]!.name).toBe('/main/task-4998');
  });
});

describe('ColumnSorter', () => {
  const many = Array.from({ length: 2_000 }, (_, index) => ({ name: `/main/task-${(index * 7919) % 2_000}` }));

  // A view that builds its columns as it renders hands a new `sortValue` each time: arrowing through 20,000 branches
  // compared every name again on every step.
  it("sorts again without comparing text when the view hands a column's sortValue as a new function", () => {
    const sorter = new ColumnSorter();
    sorter.sort(many, 'name', (row) => row.name, false);
    vi.mocked(compareSortValues).mockClear();
    const sorted = sorter.sort(many, 'name', (row) => row.name, false);
    expect(compareSortValues).not.toHaveBeenCalled();
    expect(sorted.slice(0, 3).map((row) => row.name)).toEqual(['/main/task-0', '/main/task-1', '/main/task-2']);
  });

  it('keeps each column its own ranks, so switching back to a column compares no text', () => {
    const sorter = new ColumnSorter();
    sorter.sort(many, 'name', byName, false);
    sorter.sort(many, 'length', (row) => row.name.length, false);
    vi.mocked(compareSortValues).mockClear();
    sorter.sort(many, 'name', byName, true);
    expect(compareSortValues).not.toHaveBeenCalled();
  });
});
