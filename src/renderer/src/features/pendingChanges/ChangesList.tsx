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
import { rowIndent, type ChangeRow } from './changeRows';
import { LockChip } from './locks/LockChip';
import type { PendingLocks } from './locks/pendingLocks';
import { isReviewKey, toggleReviewedFromKey } from '../review/reviewKey';
import { groupReviewStatus, type ReviewStatus } from '../review/reviewStatus';
import { ReviewToggle } from '../review/ReviewToggle';
import { SinceReviewDot } from '../review/SinceReviewDot';
import type { ListReview } from '../review/useReviewMode';
import { useChangelistDrop } from './useChangelistDrop';
import styles from './ChangesList.module.css';

const ROW_HEIGHT = 28;
/** Vim-style moves, next to the arrows. */
const LETTER_STEPS: Record<string, number> = { j: 1, k: -1 };

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
  /** The row's check and R on the selection; outside review mode, no checks or "changed since review" dots, and R turns it on. */
  review: ListReview<PendingChange>;
  locks: PendingLocks;
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
  review,
  locks,
}: ChangesListProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const changeRows = useMemo(() => rows.filter((row) => row.type === 'change'), [rows]);
  const orderedKeys = useMemo(() => changeRows.map((row) => row.key), [changeRows]);
  // The row keyboard moves go from; Shift extends the selection from the anchor to it.
  const [focusedKey, setFocusedKey] = useState<string | null>(null);
  const focused = focusedKey !== null && orderedKeys.includes(focusedKey) ? focusedKey : selection.anchor;
  const grouped = rows.some((row) => row.type === 'group');

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

  const moveBy = (step: number, extend: boolean): void => {
    const moved = selectOnArrow(selection, orderedKeys, step, extend, focused);
    if (!moved) return;
    setFocusedKey(moved.focused);
    onSelectionChange(moved.state);
    virtualizer.scrollToIndex(rows.findIndex((row) => row.key === moved.focused));
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    const plain = !event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey;
    const step = moveSteps(event.key) ?? (plain ? LETTER_STEPS[event.key] : undefined);
    if (step !== undefined) {
      event.preventDefault();
      moveBy(step, event.shiftKey);
    } else if (isReviewKey(event)) {
      event.preventDefault();
      toggleReviewedFromKey(review, selectedChanges(), () => moveBy(1, false));
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
                data-review={review.on ? (rowReviewStatus(row, review) ?? undefined) : undefined}
                style={{ top: item.start, height: ROW_HEIGHT, '--row-indent': `${rowIndent(row, grouped)}px` } as CSSProperties}
                onMouseDown={(event) => onRowMouseDown(row, event)}
                onClick={() => onRowClick(row)}
                onDoubleClick={() => row.type === 'change' && onOpen(row.change)}
                {...dragProps(row)}
                {...dropProps(row)}
              >
                <RowContent
                  row={row}
                  onToggleIncluded={onToggleIncluded}
                  changelistMenu={changelistMenu}
                  review={review}
                  locks={locks}
                />
              </div>
            );
          })}
        </div>
      </div>
    </ActionContextMenu>
  );
}

/** A file's mark, or a folder's once every file in it is reviewed; changelist headers have none. */
function rowReviewStatus(row: ChangeRow, review: ListReview<PendingChange>): ReviewStatus | null {
  if (row.type === 'change') return review.statusOf(row.change);
  return row.type === 'directory' ? groupReviewStatus(row.changes, review.statusOf) : null;
}

type RowContentProps = { row: ChangeRow } & Pick<ChangesListProps, 'onToggleIncluded' | 'changelistMenu' | 'review' | 'locks'>;

function RowContent({ row, onToggleIncluded, changelistMenu, review, locks }: RowContentProps) {
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
    case 'directory': {
      const folderStatus = review.on ? rowReviewStatus(row, review) : null;
      return (
        <>
          <ChevronRight size={13} className={styles.chevron} data-collapsed={row.collapsed} />
          <Checkbox checked={row.checkState} onChange={(checked) => onToggleIncluded(row, checked)} />
          <Folder size={14} className={styles.folder} />
          <span className={styles.directoryName}>{row.name}</span>
          {folderStatus && (
            <span className={styles.trailing}>
              <ReviewToggle folder status={folderStatus} onToggle={() => review.toggle(row.changes)} />
            </span>
          )}
        </>
      );
    }
    case 'change': {
      const { change } = row;
      const deleted = change.kinds.includes('deleted') || change.kinds.includes('locallyDeleted');
      const lock = locks.get(change.path);
      const reviewStatus = review.on ? review.statusOf(change) : null;
      return (
        <>
          {isCheckinCandidate(change) ? (
            <Checkbox checked={row.checked} onChange={(checked) => onToggleIncluded(row, checked)} />
          ) : (
            <span className={styles.checkboxPlaceholder} />
          )}
          <StatusBadge tone={changeTone(change)} title={describeKinds(change)} />
          {reviewStatus === 'changedSinceReview' && <SinceReviewDot />}
          <PathLabel path={change.path} nameOnly={row.depth > 0} oldPath={change.oldPath} strikethrough={deleted} />
          <span className={styles.trailing}>
            {change.mergeInfo && <span className={styles.tag}>{change.mergeInfo}</span>}
            {change.kinds.includes('moved') && change.kinds.includes('changed') && <span className={styles.tag}>modified</span>}
            {lock && <LockChip path={change.path} lock={lock} />}
            {reviewStatus && <ReviewToggle status={reviewStatus} onToggle={() => review.toggle([change])} />}
          </span>
        </>
      );
    }
  }
}
