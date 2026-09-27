import { useVirtualizer } from '@tanstack/react-virtual';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import type { MenuEntry } from '../../lib/actions';
import { MAIN_FOCUS } from '../../lib/mainFocus';
import { holdBackMenuKeyRelease, isListMenuKey, openContextMenuOf } from '../../lib/rowMenu';
import { isModPressed } from '../../lib/shortcuts';
import { focusedKeyOf, selectOnArrow, selectOnClick, successorKey, type SelectionState } from '../../lib/selection';
import { ActionContextMenu } from '../menu/ActionContextMenu';
import { cellText } from './cellText';
import { sortRows, type SortRanks } from './sortRows';
import { visibleColumns } from './visibleColumns';
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
  /** Selects a row whenever no shown row is selected (the first, or the one that took the place of a selected row that went away), so a details panel next to the table always has something to show. */
  selectFirstRow?: boolean;
  /** What the rows are, for screen readers (e.g. "Changesets"). */
  label?: string;
  /** Hides the column titles from sight (screen readers still get them), for a single self-explaining column. */
  hideHeader?: boolean;
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
  label,
  hideHeader = false,
}: DataTableProps<Row>) {
  const rowIdPrefix = useId();
  const viewportRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  const [tableWidth, setTableWidth] = useState(Infinity);
  const [sort, setSort] = useState(initialSort);
  // The row keyboard moves go from; until one is moved to, the selection's anchor (e.g. a selection kept from an earlier visit).
  const [focusedKey, setFocusedKey] = useState<string | null>(null);

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
  const shownColumns = visibleColumns(columns, tableWidth);

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
  const focused = focusedKeyOf(focusedKey, selection, (key) => rowsByKey.has(key));
  const focusedIndex = focused === null ? -1 : orderedKeys.indexOf(focused);

  const virtualizer = useVirtualizer({
    count: sortedRows.length,
    getScrollElement: () => viewportRef.current,
    estimateSize: () => rowHeight,
    overscan: 12,
  });

  const reveal = (key: string | null): boolean => {
    const index = key ? orderedKeys.indexOf(key) : -1;
    const viewport = viewportRef.current;
    if (index === -1 || !viewport) return false;
    const top = index * rowHeight;
    const inView = top >= viewport.scrollTop && top + rowHeight <= viewport.scrollTop + viewport.clientHeight;
    // A row out of view lands in the middle: context around it, and room for the layout above to settle (a header loading).
    if (!inView) virtualizer.scrollToIndex(index, { align: 'center' });
    return true;
  };

  // Only when the requested row changes (or appears), not on every re-render of the rows.
  useEffect(() => void reveal(revealKey ?? null), [revealKey, orderedKeys.length]);

  // A selection kept from an earlier visit shows once its row is in.
  const revealedAnchor = useRef(false);
  useEffect(() => {
    if (!revealedAnchor.current) revealedAnchor.current = reveal(selection.anchor);
  }, [orderedKeys.length]);

  const firstKey = orderedKeys[0];
  const anchorShown = selection.anchor !== null && rowsByKey.has(selection.anchor);
  // The rows before they last changed: where a selected row that went away was.
  const previousKeys = useRef<readonly string[]>([]);
  useEffect(() => {
    if (!selectFirstRow || firstKey === undefined || anchorShown) return;
    const next = successorKey(previousKeys.current, orderedKeys, selection.anchor) ?? firstKey;
    setFocusedKey(next);
    onSelectionChange({ selected: new Set([next]), anchor: next });
  }, [selectFirstRow, firstKey, anchorShown, onSelectionChange]);
  useEffect(() => {
    previousKeys.current = orderedKeys;
  }, [orderedKeys]);

  const selectedRows = (): Row[] => orderedKeys.filter((key) => selection.selected.has(key)).map((key) => rowsByKey.get(key)!);

  const moveBy = (step: number, extend: boolean): void => {
    const moved = selectOnArrow(selection, orderedKeys, step, extend, focused);
    if (!moved) return;
    setFocusedKey(moved.focused);
    onSelectionChange(moved.state);
    virtualizer.scrollToIndex(orderedKeys.indexOf(moved.focused));
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    const plain = !event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey;
    const page = Math.max(1, Math.floor((viewportRef.current?.clientHeight ?? 0) / rowHeight) - 1);
    const steps: Record<string, number> = {
      ArrowDown: 1,
      ArrowUp: -1,
      PageDown: page,
      PageUp: -page,
      Home: -Infinity,
      End: Infinity,
      ...(letterMoves && plain && { j: 1, k: -1 }),
    };
    const step = steps[event.key];
    if (step !== undefined) {
      event.preventDefault();
      moveBy(step, event.shiftKey);
    } else if (event.key === 'Enter' && focused && onActivate) {
      onActivate(rowsByKey.get(focused)!);
    } else if (event.key === 'a' && isModPressed(event)) {
      event.preventDefault();
      onSelectionChange({ selected: new Set(orderedKeys), anchor: orderedKeys[0] ?? null });
    } else if (contextMenu && focusedIndex !== -1 && isListMenuKey(event)) {
      // The menu's trigger is the rows' viewport, which the keyboard's own context-menu event (sent to the focused
      // table) never reaches.
      event.preventDefault();
      openContextMenuOf(document.getElementById(`${rowIdPrefix}-${focusedIndex}`));
    } else {
      const focusedRow = rowsByKey.get(focused ?? '');
      if (focusedRow) onRowKeyDown?.(event, focusedRow, (step) => moveBy(step, false));
    }
  };

  const onRowMouseDown = (key: string, event: React.MouseEvent): void => {
    const toggle = isModPressed(event);
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
              id={`${rowIdPrefix}-${item.index}`}
              role="row"
              aria-rowindex={item.index + 2}
              aria-selected={selection.selected.has(key)}
              className={styles.row}
              data-selected={selection.selected.has(key)}
              data-joins-above={selection.selected.has(key) && selection.selected.has(orderedKeys[item.index - 1] ?? '')}
              data-joins-below={selection.selected.has(key) && selection.selected.has(orderedKeys[item.index + 1] ?? '')}
              data-focused={key === focused}
              style={{ top: item.start, height: rowHeight }}
              onMouseDown={(event) => onRowMouseDown(key, event)}
              onDoubleClick={() => onActivate?.(row)}
            >
              {shownColumns.map((column) => (
                <div
                  key={column.id}
                  role="gridcell"
                  className={[styles.cell, column.secondary && styles.secondary, column.align === 'end' && styles.end].filter(Boolean).join(' ')}
                  style={columnStyle(column)}
                >
                  {cellText(column.render(row))}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div
      ref={tableRef}
      className={styles.table}
      tabIndex={0}
      role="grid"
      aria-label={label}
      aria-rowcount={sortedRows.length + 1}
      aria-colcount={shownColumns.length}
      aria-multiselectable
      aria-activedescendant={focusedIndex === -1 ? undefined : `${rowIdPrefix}-${focusedIndex}`}
      onKeyDown={onKeyDown}
      onKeyUp={holdBackMenuKeyRelease}
      {...MAIN_FOCUS}
    >
      <div className={hideHeader ? 'visually-hidden' : styles.header} role="row" aria-rowindex={1}>
        {shownColumns.map((column) => (
          <button
            key={column.id}
            role="columnheader"
            aria-sort={sort?.columnId === column.id ? (sort.descending ? 'descending' : 'ascending') : undefined}
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

export function columnStyle<Row>(column: Column<Row>): React.CSSProperties {
  return column.width ? { width: column.width, flex: 'none' } : { flex: column.grow ?? 1, minWidth: 80 };
}
