import { describe, expect, it, vi } from 'vitest';
import { compareSortValues } from '../../lib/naturalCompare';
import { sortRows } from './sortRows';

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

  it('re-sorts 100,000 filtered rows without comparing their text', () => {
    const many = Array.from({ length: 100_000 }, (_, index) => ({ name: `/main/task-${(index * 7919) % 100_000}` }));
    const { ranks } = sortRows(many, byName, false);
    vi.mocked(compareSortValues).mockClear();
    const sorted = sortRows(many.filter((_, index) => index % 2 === 0), byName, true, ranks);
    expect(compareSortValues).not.toHaveBeenCalled();
    expect(sorted.rows[0]!.name).toBe('/main/task-99998');
  });
});
