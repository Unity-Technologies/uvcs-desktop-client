import { useVirtualizer } from '@tanstack/react-virtual';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import type { MenuEntry } from '../../lib/actions';
import { isMac } from '../../lib/platform';
import { selectOnArrow, selectOnClick, type SelectionState } from '../../lib/selection';
import { ActionContextMenu } from '../menu/ActionContextMenu';
import styles from './DataTable.module.css';

export interface Column<Row> {
  id: string;
  header: string;
  /** Fixed width in pixels; columns without one share the remaining space. */
  width?: number;
  /** Relative share of the remaining space for flexible columns (default 1). */
  grow?: number;
  align?: 'start' | 'end';
  secondary?: boolean;
  /** Hidden while the table is narrower than this, so the flexible columns (a comment, a name) keep room to be read. */
  hideBelow?: number;
  render: (row: Row) => ReactNode;
  sortValue?: (row: Row) => string | number;
}

interface DataTableProps<Row> {
  rows: readonly Row[];
  columns: Column<Row>[];
  rowKey: (row: Row) => string;
  selection: SelectionState;
  onSelectionChange: (selection: SelectionState) => void;
  /** Double click or Enter. */
  onActivate?: (row: Row) => void;
  contextMenu?: (selectedRows: Row[]) => MenuEntry[];
  rowHeight?: number;
  initialSort?: { columnId: string; descending: boolean };
  /** Keys the table does not handle itself (e.g. ←/→ to collapse or expand a tree row); `moveBy` moves the selection like the arrows. */
  onRowKeyDown?: (event: KeyboardEvent, focusedRow: Row, moveBy: (step: number) => void) => void;
  /** J and K move like ↓ and ↑, for lists read one row after another (e.g. reviewing files). */
  letterMoves?: boolean;
  /** Scrolls this row into view (centered) whenever it changes, e.g. after revealing a search result. */
  revealKey?: string | null;
  /** Selects the first row whenever no shown row is selected, so a details panel next to the table always has something to show. */
  selectFirstRow?: boolean;
}

export function DataTable<Row>({
  rows,
  columns,
  rowKey,
  selection,
  onSelectionChange,
  onActivate,
  contextMenu,
  rowHeight = 30,
  initialSort,
  onRowKeyDown,
  letterMoves = false,
  revealKey,
  selectFirstRow = false,
}: DataTableProps<Row>) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  const [tableWidth, setTableWidth] = useState(Infinity);
  const [sort, setSort] = useState(initialSort);
  const [focusedKey, setFocusedKey] = useState<string | null>(null);

  const sortedRows = useMemo(() => sortRows(rows, columns, sort), [rows, columns, sort]);
  const shownColumns = columns.filter((column) => !column.hideBelow || tableWidth >= column.hideBelow);

  const hidesColumns = columns.some((column) => column.hideBelow);
  useLayoutEffect(() => {
    const table = tableRef.current;
    if (!table || !hidesColumns) return;
    const observer = new ResizeObserver(() => setTableWidth(table.clientWidth));
    observer.observe(table);
    return () => observer.disconnect();
  }, [hidesColumns]);
  const orderedKeys = useMemo(() => sortedRows.map(rowKey), [sortedRows, rowKey]);
  const rowsByKey = useMemo(() => new Map(sortedRows.map((row) => [rowKey(row), row])), [sortedRows, rowKey]);

  const virtualizer = useVirtualizer({
    count: sortedRows.length,
    getScrollElement: () => viewportRef.current,
    estimateSize: () => rowHeight,
    overscan: 12,
  });

  useEffect(() => {
    const index = revealKey ? orderedKeys.indexOf(revealKey) : -1;
    const viewport = viewportRef.current;
    if (index === -1 || !viewport) return;
    const top = index * rowHeight;
    const inView = top >= viewport.scrollTop && top + rowHeight <= viewport.scrollTop + viewport.clientHeight;
    // A row out of view lands in the middle: context around it, and room for the layout above to settle (a header loading).
    if (!inView) virtualizer.scrollToIndex(index, { align: 'center' });
    // Only when the requested row changes (or appears), not on every re-render of the rows.
  }, [revealKey, orderedKeys.length]);

  const firstKey = orderedKeys[0];
  const anchorShown = selection.anchor !== null && rowsByKey.has(selection.anchor);
  useEffect(() => {
    if (!selectFirstRow || firstKey === undefined || anchorShown) return;
    setFocusedKey(firstKey);
    onSelectionChange({ selected: new Set([firstKey]), anchor: firstKey });
  }, [selectFirstRow, firstKey, anchorShown, onSelectionChange]);

  const selectedRows = (): Row[] => orderedKeys.filter((key) => selection.selected.has(key)).map((key) => rowsByKey.get(key)!);

  const moveBy = (step: number, extend: boolean): void => {
    const moved = selectOnArrow(selection, orderedKeys, step, extend, focusedKey);
    if (!moved) return;
    setFocusedKey(moved.focused);
    onSelectionChange(moved.state);
    virtualizer.scrollToIndex(orderedKeys.indexOf(moved.focused));
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    const plain = !event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey;
    const steps: Record<string, number> = { ArrowDown: 1, ArrowUp: -1, ...(letterMoves && plain && { j: 1, k: -1 }) };
    const step = steps[event.key];
    if (step !== undefined) {
      event.preventDefault();
      moveBy(step, event.shiftKey);
    } else if (event.key === 'Enter' && focusedKey && onActivate) {
      onActivate(rowsByKey.get(focusedKey)!);
    } else if (event.key === 'a' && (isMac ? event.metaKey : event.ctrlKey)) {
      event.preventDefault();
      onSelectionChange({ selected: new Set(orderedKeys), anchor: orderedKeys[0] ?? null });
    } else {
      const focusedRow = rowsByKey.get(focusedKey ?? selection.anchor ?? '');
      if (focusedRow) onRowKeyDown?.(event, focusedRow, (step) => moveBy(step, false));
    }
  };

  const onRowMouseDown = (key: string, event: React.MouseEvent): void => {
    const toggle = isMac ? event.metaKey : event.ctrlKey;
    // Right-clicking inside the selection keeps it, so the context menu acts on all selected rows.
    if (event.button === 2 && selection.selected.has(key)) return;
    setFocusedKey(key);
    onSelectionChange(selectOnClick(selection, key, orderedKeys, { shift: event.shiftKey, toggle }));
  };

  const toggleSort = (column: Column<Row>): void => {
    if (!column.sortValue) return;
    setSort((current) =>
      current?.columnId === column.id ? { columnId: column.id, descending: !current.descending } : { columnId: column.id, descending: false },
    );
  };

  const body = (
    <div ref={viewportRef} className={styles.viewport}>
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
        {virtualizer.getVirtualItems().map((item) => {
          const row = sortedRows[item.index]!;
          const key = orderedKeys[item.index]!;
          return (
            <div
              key={key}
              className={styles.row}
              data-selected={selection.selected.has(key)}
              style={{ top: item.start, height: rowHeight }}
              onMouseDown={(event) => onRowMouseDown(key, event)}
              onDoubleClick={() => onActivate?.(row)}
            >
              {shownColumns.map((column) => (
                <div
                  key={column.id}
                  className={[styles.cell, column.secondary && styles.secondary, column.align === 'end' && styles.end].filter(Boolean).join(' ')}
                  style={columnStyle(column)}
                >
                  {column.render(row)}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div ref={tableRef} className={styles.table} tabIndex={0} onKeyDown={onKeyDown}>
      <div className={styles.header}>
        {shownColumns.map((column) => (
          <button
            key={column.id}
            className={[styles.headerCell, column.sortValue && styles.sortable, column.align === 'end' && styles.end].filter(Boolean).join(' ')}
            style={columnStyle(column)}
            onClick={() => toggleSort(column)}
            tabIndex={-1}
          >
            {column.header}
            {sort?.columnId === column.id && (sort.descending ? <ArrowDown size={11} /> : <ArrowUp size={11} />)}
          </button>
        ))}
      </div>
      {contextMenu ? <ActionContextMenu entries={() => contextMenu(selectedRows())}>{body}</ActionContextMenu> : body}
    </div>
  );
}

function columnStyle<Row>(column: Column<Row>): React.CSSProperties {
  return column.width ? { width: column.width, flex: 'none' } : { flex: column.grow ?? 1, minWidth: 80 };
}

function sortRows<Row>(rows: readonly Row[], columns: Column<Row>[], sort: { columnId: string; descending: boolean } | undefined): readonly Row[] {
  const sortValue = columns.find((column) => column.id === sort?.columnId)?.sortValue;
  if (!sort || !sortValue) return rows;

  const direction = sort.descending ? -1 : 1;
  return [...rows].sort((a, b) => {
    const left = sortValue(a);
    const right = sortValue(b);
    return (left < right ? -1 : left > right ? 1 : 0) * direction;
  });
}
