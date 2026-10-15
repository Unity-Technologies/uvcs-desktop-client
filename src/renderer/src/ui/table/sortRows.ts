import { compareSortValues } from '../../lib/naturalCompare';

type SortValue = string | number;

/**
 * Where each value a column sorts by falls among the others (equal values share a place), so the rows of a list are
 * sorted again with a number compare. Filtering a sorted list re-sorts it on every keystroke, and comparing text as
 * people read it (`naturalCompare`) is what costs: known values skip it.
 */
export type SortRanks = Map<SortValue, number>;

/**
 * `rows` ordered by `sortValue` (stable: equal values keep their order), with the ranks it used. `ranks` from an earlier
 * call with the same `sortValue` are reused while they know every value; otherwise they're computed again for these rows.
 */
export function sortRows<Row>(
  rows: readonly Row[],
  sortValue: (row: Row) => SortValue,
  descending: boolean,
  ranks: SortRanks = new Map(),
): { rows: Row[]; ranks: SortRanks } {
  const values = rows.map(sortValue);
  const known = values.every((value) => ranks.has(value));
  const usedRanks = known ? ranks : rankValues(values);
  const direction = descending ? -1 : 1;
  const order = values.map((value, index) => ({ rank: usedRanks.get(value)!, index }));
  order.sort((a, b) => (a.rank - b.rank) * direction);
  return { rows: order.map(({ index }) => rows[index]!), ranks: usedRanks };
}

/**
 * Sorts a table's rows by one column or another, keeping each column's ranks for its next sort. They're kept by column
 * id, not by the column's `sortValue` function: a view that builds its columns as it renders hands a new function every
 * time, and ranks kept by function would compare the text of every row again on each render (arrowing through 20,000
 * branches took 50 ms a step). Ranks only say how values compare (`compareSortValues`), so they hold for whichever
 * function reads them; a value they don't know ranks the rows again (`sortRows`).
 */
export class ColumnSorter {
  private readonly ranksByColumn = new Map<string, SortRanks>();

  sort<Row>(rows: readonly Row[], columnId: string, sortValue: (row: Row) => SortValue, descending: boolean): Row[] {
    const sorted = sortRows(rows, sortValue, descending, this.ranksByColumn.get(columnId));
    this.ranksByColumn.set(columnId, sorted.ranks);
    return sorted.rows;
  }
}

function rankValues(values: readonly SortValue[]): SortRanks {
  const distinct = [...new Set(values)].sort(compareSortValues);
  const ranks: SortRanks = new Map();
  let rank = 0;
  distinct.forEach((value, index) => {
    if (index > 0 && compareSortValues(distinct[index - 1]!, value) !== 0) rank = index;
    ranks.set(value, rank);
  });
  return ranks;
}
