import { useVirtualizer } from '@tanstack/react-virtual';
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import type { MenuEntry } from '../../lib/actions';
import { MAIN_FOCUS } from '../../lib/mainFocus';
import { holdBackMenuKeyRelease, isListMenuKey, openContextMenuOf } from '../../lib/rowMenu';
import { isModPressed } from '../../lib/shortcuts';
import { focusedKeyOf, selectOnArrow, selectOnClick, type SelectionState } from '../../lib/selection';
import { ActionContextMenu } from '../menu/ActionContextMenu';
import type { Column } from './column';
import { DataTableHeader } from './DataTableHeader';
import { DataTableRow } from './DataTableRow';
import { rowsPerPage, selectionStep } from './tableKeys';
import { useKeepRowSelected } from './useKeepRowSelected';
import { useSortedRows, type TableSort } from './useSortedRows';
import { useTableWidth } from './useTableWidth';
import { visibleColumns } from './visibleColumns';
import styles from './DataTable.module.css';

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
  initialSort?: TableSort;
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
  /** Rows as a list of entries, for tall rows of several lines in a list without column titles: each fills the width, with a hairline between. */
  divided?: boolean;
}

/**
 * The app's list of rows: sortable columns, the selection of a desktop list (click, ⌘/Ctrl, Shift, the arrows,
 * PageUp/PageDown, Home/End, ⌘A), Enter or a double click to open, and the rows' context menu. Only the rows in view
 * are rendered, so it takes any number of them. It is a `grid` whose focused row is its `aria-activedescendant`.
 */
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
  divided = false,
}: DataTableProps<Row>) {
  const rowIdPrefix = useId();
  const rowId = (index: number): string => `${rowIdPrefix}-${index}`;
  const viewportRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  // The row keyboard moves go from; until one is moved to, the selection's anchor (e.g. a selection kept from an earlier visit).
  const [focusedKey, setFocusedKey] = useState<string | null>(null);

  const { sortedRows, sort, toggleSort } = useSortedRows(rows, columns, initialSort);
  const tableWidth = useTableWidth(tableRef, columns.some((column) => column.hideBelow));
  const shownColumns = visibleColumns(columns, tableWidth);

  const orderedKeys = useMemo(() => sortedRows.map(rowKey), [sortedRows, rowKey]);
  const rowsByKey = useMemo(() => new Map(sortedRows.map((row) => [rowKey(row), row])), [sortedRows, rowKey]);
  const isShown = (key: string): boolean => rowsByKey.has(key);
  const focused = focusedKeyOf(focusedKey, selection, isShown);
  const focusedIndex = focused === null ? -1 : orderedKeys.indexOf(focused);

  const virtualizer = useVirtualizer({
    count: sortedRows.length,
    getScrollElement: () => viewportRef.current,
    estimateSize: () => rowHeight,
    overscan: 12,
  });

  /** Scrolls a shown row into view; false when it isn't shown (yet). */
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

  useKeepRowSelected({ enabled: selectFirstRow, orderedKeys, isShown, selection, onSelectionChange, focusRow: setFocusedKey });

  const selectedRows = (): Row[] => orderedKeys.filter((key) => selection.selected.has(key)).map((key) => rowsByKey.get(key)!);

  const moveBy = (step: number, extend: boolean): void => {
    const moved = selectOnArrow(selection, orderedKeys, step, extend, focused);
    if (!moved) return;
    setFocusedKey(moved.focused);
    onSelectionChange(moved.state);
    virtualizer.scrollToIndex(orderedKeys.indexOf(moved.focused));
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    const step = selectionStep(event, { pageRows: rowsPerPage(viewportRef.current?.clientHeight ?? 0, rowHeight), letterMoves });
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
      openContextMenuOf(document.getElementById(rowId(focusedIndex)));
    } else {
      const focusedRow = rowsByKey.get(focused ?? '');
      if (focusedRow) onRowKeyDown?.(event, focusedRow, (step) => moveBy(step, false));
    }
  };

  const onRowMouseDown = (key: string, event: MouseEvent): void => {
    // Right-clicking inside the selection keeps it, so the context menu acts on all selected rows.
    if (event.button === 2 && selection.selected.has(key)) return;
    setFocusedKey(key);
    onSelectionChange(selectOnClick(selection, key, orderedKeys, { shift: event.shiftKey, toggle: isModPressed(event) }));
  };

  const isSelectedAt = (index: number): boolean => selection.selected.has(orderedKeys[index] ?? '');
  const body = (
    <div ref={viewportRef} className={styles.viewport}>
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
        {virtualizer.getVirtualItems().map(({ index, start }) => {
          const key = orderedKeys[index]!;
          const row = sortedRows[index]!;
          const selected = isSelectedAt(index);
          return (
            <DataTableRow
              key={key}
              row={row}
              id={rowId(index)}
              index={index}
              rowCount={sortedRows.length}
              columns={shownColumns}
              top={start}
              height={rowHeight}
              selected={selected}
              joinsAbove={selected && isSelectedAt(index - 1)}
              joinsBelow={selected && isSelectedAt(index + 1)}
              focused={key === focused}
              divided={divided}
              onMouseDown={(event) => onRowMouseDown(key, event)}
              onDoubleClick={() => onActivate?.(row)}
            />
          );
        })}
      </div>
    </div>
  );

  return (
    <div
      ref={tableRef}
      className={styles.table}
      data-divided={divided || undefined}
      tabIndex={0}
      role="grid"
      aria-label={label}
      aria-rowcount={sortedRows.length + 1}
      aria-colcount={shownColumns.length}
      aria-multiselectable
      aria-activedescendant={focusedIndex === -1 ? undefined : rowId(focusedIndex)}
      onKeyDown={onKeyDown}
      onKeyUp={holdBackMenuKeyRelease}
      {...MAIN_FOCUS}
    >
      <DataTableHeader columns={shownColumns} sort={sort} onSort={toggleSort} hidden={hideHeader} />
      {contextMenu ? <ActionContextMenu entries={() => contextMenu(selectedRows())}>{body}</ActionContextMenu> : body}
    </div>
  );
}
