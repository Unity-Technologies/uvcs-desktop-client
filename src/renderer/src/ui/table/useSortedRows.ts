import { useMemo, useState } from 'react';
import type { Column } from './column';
import { ColumnSorter } from './sortRows';

export interface TableSort {
  columnId: string;
  descending: boolean;
}

/**
 * A table's rows in the order its header asks for, and the header's sort: clicking a sortable column sorts by it,
 * clicking it again turns the order around. Unsorted until a column is clicked, without `initialSort`.
 */
export function useSortedRows<Row>(rows: readonly Row[], columns: Column<Row>[], initialSort: TableSort | undefined) {
  const [sort, setSort] = useState(initialSort);
  const sortValue = columns.find((column) => column.id === sort?.columnId)?.sortValue;
  // Keeps each column's ranks, so filtering a sorted list re-sorts it by number (`ColumnSorter`).
  const [sorter] = useState(() => new ColumnSorter());

  const sortedRows = useMemo(
    () => (sort && sortValue ? sorter.sort(rows, sort.columnId, sortValue, sort.descending) : rows),
    [sorter, rows, sortValue, sort],
  );

  const toggleSort = (column: Column<Row>): void => {
    if (!column.sortValue) return;
    setSort((current) =>
      current?.columnId === column.id ? { columnId: column.id, descending: !current.descending } : { columnId: column.id, descending: false },
    );
  };

  return { sortedRows, sort, toggleSort };
}
