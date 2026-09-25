import { useVirtualizer } from '@tanstack/react-virtual';
import { ChevronRight, Folder, MoreHorizontal } from 'lucide-react';
import { useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent } from 'react';
import type { Changelist, PendingChange } from '@shared/domain/pendingChanges';
import { PathLabel } from '../../components/PathLabel';
import { StatusBadge } from '../../components/StatusBadge';
import type { MenuEntry } from '../../lib/actions';
import { isMac } from '../../lib/platform';
import { selectOnArrow, selectOnClick, type SelectionState } from '../../lib/selection';
import { Checkbox } from '../../ui/Checkbox';
import { ActionContextMenu } from '../../ui/menu/ActionContextMenu';
import { ActionDropdownMenu } from '../../ui/menu/ActionDropdownMenu';
import { describeKinds, isCheckinCandidate } from './changeCategories';
import { changeTone } from './changeTone';
import { hasDisclosureRows, rowIndent, type ChangeRow } from './changeRows';
import { useChangelistDrop } from './useChangelistDrop';
import styles from './ChangesList.module.css';

const ROW_HEIGHT = 28;

interface ChangesListProps {
  rows: ChangeRow[];
  selection: SelectionState;
  onSelectionChange: (selection: SelectionState) => void;
  onToggleIncluded: (row: ChangeRow, included: boolean) => void;
  onToggleCollapsed: (rowKey: string) => void;
  /** Enter or double-click on a change. */
  onOpen: (change: PendingChange) => void;
  /** Dropping changes on a changelist header; changelist headers are only drop targets when this is set. */
  onMoveToChangelist?: (changes: PendingChange[], changelist: string | null) => void;
  contextMenu: (selected: PendingChange[]) => MenuEntry[];
  changelistMenu: (changelist: Changelist) => MenuEntry[];
}

export function ChangesList({
  rows,
  selection,
  onSelectionChange,
  onToggleIncluded,
  onToggleCollapsed,
  onOpen,
  onMoveToChangelist,
  contextMenu,
  changelistMenu,
}: ChangesListProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const changeRows = useMemo(() => rows.filter((row) => row.type === 'change'), [rows]);
  const orderedKeys = useMemo(() => changeRows.map((row) => row.key), [changeRows]);
  // The row keyboard moves go from; Shift extends the selection from the anchor to it.
  const [focusedKey, setFocusedKey] = useState<string | null>(null);
  const focused = focusedKey !== null && orderedKeys.includes(focusedKey) ? focusedKey : selection.anchor;
  const indentLayout = { grouped: rows.some((row) => row.type === 'group'), disclosure: hasDisclosureRows(rows) };

  // A plain press on a row of a multi-selection keeps the selection until release, so the whole of it can be dragged.
  const narrowOnClick = useRef<string | null>(null);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => viewportRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 16,
  });

  const selectedChanges = (): PendingChange[] => changeRows.filter((row) => selection.selected.has(row.key)).map((row) => row.change);
  const { dragProps, dropProps, dropTarget } = useChangelistDrop({ selection, onSelectionChange, selectedChanges, onMoveToChangelist });

  const moveSteps = (key: string): number | undefined => {
    const page = Math.max(1, Math.floor((viewportRef.current?.clientHeight ?? 0) / ROW_HEIGHT) - 1);
    const steps: Record<string, number> = { ArrowDown: 1, ArrowUp: -1, PageDown: page, PageUp: -page, Home: -Infinity, End: Infinity };
    return steps[key];
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    const step = moveSteps(event.key);
    if (step !== undefined) {
      event.preventDefault();
      const moved = selectOnArrow(selection, orderedKeys, step, event.shiftKey, focused);
      if (!moved) return;
      setFocusedKey(moved.focused);
      onSelectionChange(moved.state);
      virtualizer.scrollToIndex(rows.findIndex((row) => row.key === moved.focused));
    } else if (event.key === ' ') {
      event.preventDefault();
      const selectedRows = changeRows.filter((row) => selection.selected.has(row.key));
      const include = selectedRows.some((row) => !row.checked);
      selectedRows.forEach((row) => onToggleIncluded(row, include));
    } else if (event.key === 'a' && (isMac ? event.metaKey : event.ctrlKey)) {
      event.preventDefault();
      onSelectionChange({ selected: new Set(orderedKeys), anchor: orderedKeys[0] ?? null });
    } else if (event.key === 'Enter' && focused) {
      const focusedRow = changeRows.find((row) => row.key === focused);
      if (focusedRow) onOpen(focusedRow.change);
    }
  };

  const onRowMouseDown = (row: ChangeRow, event: MouseEvent): void => {
    if (row.type !== 'change') {
      if (event.button === 0) onToggleCollapsed(row.key);
      return;
    }
    if (event.button === 2 && selection.selected.has(row.key)) return;
    const toggle = isMac ? event.metaKey : event.ctrlKey;
    if (event.button === 0 && !event.shiftKey && !toggle && selection.selected.size > 1 && selection.selected.has(row.key)) {
      narrowOnClick.current = row.key;
      return;
    }
    setFocusedKey(row.key);
    onSelectionChange(selectOnClick(selection, row.key, orderedKeys, { shift: event.shiftKey, toggle }));
  };

  const onRowClick = (row: ChangeRow): void => {
    if (narrowOnClick.current !== row.key) return;
    narrowOnClick.current = null;
    setFocusedKey(row.key);
    onSelectionChange({ selected: new Set([row.key]), anchor: row.key });
  };

  return (
    <ActionContextMenu entries={() => contextMenu(selectedChanges())}>
      <div ref={viewportRef} className={styles.list} tabIndex={0} onKeyDown={onKeyDown}>
        <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
          {virtualizer.getVirtualItems().map((item) => {
            const row = rows[item.index]!;
            return (
              <div
                key={row.key}
                className={styles.row}
                data-type={row.type}
                data-selected={selection.selected.has(row.key)}
                data-drop-target={dropTarget === row.key}
                style={{ top: item.start, height: ROW_HEIGHT, '--row-indent': `${rowIndent(row, indentLayout)}px` } as CSSProperties}
                onMouseDown={(event) => onRowMouseDown(row, event)}
                onClick={() => onRowClick(row)}
                onDoubleClick={() => row.type === 'change' && onOpen(row.change)}
                {...dragProps(row)}
                {...dropProps(row)}
              >
                <RowContent row={row} onToggleIncluded={onToggleIncluded} changelistMenu={changelistMenu} />
              </div>
            );
          })}
        </div>
      </div>
    </ActionContextMenu>
  );
}

interface RowContentProps {
  row: ChangeRow;
  onToggleIncluded: ChangesListProps['onToggleIncluded'];
  changelistMenu: ChangesListProps['changelistMenu'];
}

function RowContent({ row, onToggleIncluded, changelistMenu }: RowContentProps) {
  switch (row.type) {
    case 'group':
      return (
        <>
          <ChevronRight size={13} className={styles.chevron} data-collapsed={row.collapsed} />
          <Checkbox checked={row.checkState} onChange={(checked) => onToggleIncluded(row, checked)} />
          <span className={styles.groupLabel} data-tip={row.changelist?.description}>
            {row.label}
          </span>
          {row.changelist && (
            <ActionDropdownMenu entries={changelistMenu(row.changelist)}>
              <button className={styles.groupMenu} onMouseDown={(event) => event.stopPropagation()} aria-label="Changelist actions">
                <MoreHorizontal size={14} />
              </button>
            </ActionDropdownMenu>
          )}
          <span className={styles.count}>{row.changes.length}</span>
        </>
      );
    case 'directory':
      return (
        <>
          <ChevronRight size={13} className={styles.chevron} data-collapsed={row.collapsed} />
          <Checkbox checked={row.checkState} onChange={(checked) => onToggleIncluded(row, checked)} />
          <Folder size={14} className={styles.folder} />
          <span className={styles.directoryName}>{row.name}</span>
        </>
      );
    case 'change': {
      const { change } = row;
      const deleted = change.kinds.includes('deleted') || change.kinds.includes('locallyDeleted');
      return (
        <>
          {isCheckinCandidate(change) ? (
            <Checkbox checked={row.checked} onChange={(checked) => onToggleIncluded(row, checked)} />
          ) : (
            <span className={styles.checkboxPlaceholder} />
          )}
          <StatusBadge tone={changeTone(change)} title={describeKinds(change)} />
          <PathLabel path={change.path} nameOnly={row.depth > 0} oldPath={change.oldPath} strikethrough={deleted} />
          {change.mergeInfo && <span className={styles.tag}>{change.mergeInfo}</span>}
          {change.kinds.includes('moved') && change.kinds.includes('changed') && <span className={styles.tag}>modified</span>}
        </>
      );
    }
  }
}
