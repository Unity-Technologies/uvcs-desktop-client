import type { MouseEvent } from 'react';
import { classNames } from '../../lib/classNames';
import { cellText } from './cellText';
import { columnStyle, type Column } from './column';
import styles from './DataTable.module.css';

interface DataTableRowProps<Row> {
  row: Row;
  /** The element id `aria-activedescendant` points at while the row is focused. */
  id: string;
  /** Its place among every row of the table, the header's row first (`aria-rowindex` counts from 1). */
  index: number;
  rowCount: number;
  columns: Column<Row>[];
  /** Pixels from the top of the table's rows, where the virtual list places it. */
  top: number;
  height: number;
  selected: boolean;
  /** The rows above and below are selected too: the highlights join into one block. */
  joinsAbove: boolean;
  joinsBelow: boolean;
  focused: boolean;
  divided: boolean;
  onMouseDown: (event: MouseEvent) => void;
  onDoubleClick: () => void;
}

/** One row of a `DataTable`: a cell per shown column, placed where the virtual list puts it. */
export function DataTableRow<Row>({ row, id, index, rowCount, columns, top, height, selected, joinsAbove, joinsBelow, focused, divided, onMouseDown, onDoubleClick }: DataTableRowProps<Row>) {
  return (
    <div
      id={id}
      role="row"
      aria-rowindex={index + 2}
      aria-selected={selected}
      className={styles.row}
      data-selected={selected}
      data-joins-above={joinsAbove}
      data-joins-below={joinsBelow}
      data-focused={focused}
      data-divided={divided ? dividerPlace(index, rowCount) : undefined}
      style={{ top, height }}
      onMouseDown={onMouseDown}
      onDoubleClick={onDoubleClick}
    >
      {columns.map((column) => (
        <div
          key={column.id}
          role="gridcell"
          className={classNames(styles.cell, column.secondary && styles.secondary, column.align === 'end' && styles.end)}
          style={columnStyle(column)}
        >
          {cellText(column.render(row))}
        </div>
      ))}
    </div>
  );
}

/** Where a divided row sits, for its hairlines: one between rows and one under the last. */
function dividerPlace(index: number, rowCount: number): 'first' | 'between' | 'last' {
  if (index === rowCount - 1) return 'last';
  return index > 0 ? 'between' : 'first';
}
