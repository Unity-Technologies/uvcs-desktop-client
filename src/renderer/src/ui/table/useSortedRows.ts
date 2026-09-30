import { useMemo, useRef, useState } from 'react';
import type { Column } from './column';
import { sortRows, type SortRanks } from './sortRows';

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
  // Kept per column, so filtering a sorted list re-sorts it by number (`sortRows`).
  const sortRanks = useRef<{ sortValue?: Column<Row>['sortValue']; ranks?: SortRanks }>({});

  const sortedRows = useMemo(() => {
    if (!sort || !sortValue) return rows;
    const kept = sortRanks.current.sortValue === sortValue ? sortRanks.current.ranks : undefined;
    const sorted = sortRows(rows, sortValue, sort.descending, kept);
    sortRanks.current = { sortValue, ranks: sorted.ranks };
    return sorted.rows;
  }, [rows, sortValue, sort]);

  const toggleSort = (column: Column<Row>): void => {
    if (!column.sortValue) return;
    setSort((current) =>
      current?.columnId === column.id ? { columnId: column.id, descending: !current.descending } : { columnId: column.id, descending: false },
    );
  };

  return { sortedRows, sort, toggleSort };
}
