import { classNames } from '../../lib/classNames';
import { skeletonWidth, SkeletonBar, SkeletonRows } from '../Skeleton';
import { columnStyle, type Column } from './column';
import tableStyles from './DataTable.module.css';
import styles from './TableSkeleton.module.css';

interface TableSkeletonProps<Row> {
  /** The table's columns: the real header shows, and each placeholder bar sits in its column. */
  columns: Column<Row>[];
  rowHeight?: number;
}

/** A `DataTable` that is still loading: its header, then placeholder rows at the real row height. */
export function TableSkeleton<Row>({ columns, rowHeight = 30 }: TableSkeletonProps<Row>) {
  // Columns hidden in narrow tables would crowd the placeholder; the ones always shown are enough.
  const shown = columns.filter((column) => !column.hideBelow);
  return (
    <div className={tableStyles.table}>
      <div className={tableStyles.header}>
        {shown.map((column) => (
          <div key={column.id} className={classNames(tableStyles.headerCell, column.align === 'end' && tableStyles.end)} style={columnStyle(column)}>
            {column.header}
          </div>
        ))}
      </div>
      <SkeletonRows rowHeight={rowHeight} rowClassName={styles.row}>
        {(index) =>
          shown.map((column, columnIndex) => (
            <div key={column.id} className={classNames(tableStyles.cell, column.align === 'end' && tableStyles.end)} style={columnStyle(column)}>
              <SkeletonBar width={skeletonWidth(index, columnIndex)} />
            </div>
          ))
        }
      </SkeletonRows>
    </div>
  );
}
