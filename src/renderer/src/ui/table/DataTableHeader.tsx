import { ArrowDown, ArrowUp } from 'lucide-react';
import { classNames } from '../../lib/classNames';
import { columnStyle, type Column } from './column';
import type { TableSort } from './useSortedRows';
import styles from './DataTable.module.css';

interface DataTableHeaderProps<Row> {
  columns: Column<Row>[];
  sort: TableSort | undefined;
  onSort: (column: Column<Row>) => void;
  /** Hidden from sight; screen readers still get the column titles. */
  hidden: boolean;
}

/** The column titles of a `DataTable`: clicking a sortable one sorts by it, its arrow telling the order. */
export function DataTableHeader<Row>({ columns, sort, onSort, hidden }: DataTableHeaderProps<Row>) {
  return (
    <div className={hidden ? 'visually-hidden' : styles.header} role="row" aria-rowindex={1}>
      {columns.map((column) => {
        const sorted = sort?.columnId === column.id ? sort : undefined;
        return (
          <button
            key={column.id}
            role="columnheader"
            aria-sort={sorted ? (sorted.descending ? 'descending' : 'ascending') : undefined}
            className={classNames(styles.headerCell, column.sortValue && styles.sortable, column.align === 'end' && styles.end)}
            style={columnStyle(column)}
            onClick={() => onSort(column)}
            // The table takes the keyboard; the header is for the pointer.
            tabIndex={-1}
          >
            {column.header}
            {sorted && (sorted.descending ? <ArrowDown size={11} /> : <ArrowUp size={11} />)}
          </button>
        );
      })}
    </div>
  );
}
