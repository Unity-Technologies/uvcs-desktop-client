import { useVirtualizer } from '@tanstack/react-virtual';
import { ChevronRight, Folder } from 'lucide-react';
import { useMemo, useRef, type KeyboardEvent } from 'react';
import type { PendingChange } from '@shared/domain/pendingChanges';
import { PathLabel } from '../../components/PathLabel';
import { StatusBadge } from '../../components/StatusBadge';
import type { MenuEntry } from '../../lib/actions';
import { isMac } from '../../lib/platform';
import { selectOnArrow, selectOnClick, type SelectionState } from '../../lib/selection';
import { Checkbox } from '../../ui/Checkbox';
import { ActionContextMenu } from '../../ui/menu/ActionContextMenu';
import { describeKinds, isCheckinCandidate } from './changeCategories';
import { changeTone } from './changeTone';
import type { ChangeRow } from './changeRows';
import styles from './ChangesList.module.css';

const ROW_HEIGHT = 28;
const INDENT = 16;

interface ChangesListProps {
  rows: ChangeRow[];
  selection: SelectionState;
  onSelectionChange: (selection: SelectionState) => void;
  onToggleIncluded: (row: ChangeRow, included: boolean) => void;
  onToggleCollapsed: (rowKey: string) => void;
  onOpen: (change: PendingChange) => void;
  contextMenu: (selected: PendingChange[]) => MenuEntry[];
}

export function ChangesList({ rows, selection, onSelectionChange, onToggleIncluded, onToggleCollapsed, onOpen, contextMenu }: ChangesListProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const changeRows = useMemo(() => rows.filter((row) => row.type === 'change'), [rows]);
  const orderedKeys = useMemo(() => changeRows.map((row) => row.key), [changeRows]);
  const focusedKey = selection.anchor;

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => viewportRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 16,
  });

  const selectedChanges = (): PendingChange[] => changeRows.filter((row) => selection.selected.has(row.key)).map((row) => row.change);

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const moved = selectOnArrow(selection, orderedKeys, event.key === 'ArrowDown' ? 1 : -1, event.shiftKey, focusedKey);
      if (!moved) return;
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
    } else if (event.key === 'Enter' && focusedKey) {
      const focused = changeRows.find((row) => row.key === focusedKey);
      if (focused) onOpen(focused.change);
    }
  };

  const onRowMouseDown = (row: ChangeRow, event: React.MouseEvent): void => {
    if (row.type !== 'change') {
      if (event.button === 0) onToggleCollapsed(row.key);
      return;
    }
    if (event.button === 2 && selection.selected.has(row.key)) return;
    onSelectionChange(selectOnClick(selection, row.key, orderedKeys, { shift: event.shiftKey, toggle: isMac ? event.metaKey : event.ctrlKey }));
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
                style={{ top: item.start, height: ROW_HEIGHT }}
                onMouseDown={(event) => onRowMouseDown(row, event)}
                onDoubleClick={() => row.type === 'change' && onOpen(row.change)}
              >
                <RowContent row={row} onToggleIncluded={onToggleIncluded} />
              </div>
            );
          })}
        </div>
      </div>
    </ActionContextMenu>
  );
}

function RowContent({ row, onToggleIncluded }: { row: ChangeRow; onToggleIncluded: ChangesListProps['onToggleIncluded'] }) {
  switch (row.type) {
    case 'category':
      return (
        <>
          <ChevronRight size={13} className={styles.chevron} data-collapsed={row.collapsed} />
          <Checkbox checked={row.checkState} onChange={(checked) => onToggleIncluded(row, checked)} />
          <span className={styles.categoryLabel}>{row.label}</span>
          <span className={styles.count}>{row.count}</span>
        </>
      );
    case 'directory':
      return (
        <>
          <span style={{ width: row.depth * INDENT }} />
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
          <span style={{ width: row.depth * INDENT + 17 }} />
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
