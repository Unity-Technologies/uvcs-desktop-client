import { useVirtualizer } from '@tanstack/react-virtual';
import { ChevronRight, MoreHorizontal } from 'lucide-react';
import { memo, useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent } from 'react';
import type { Changelist, PendingChange } from '@shared/domain/pendingChanges';
import { ItemIcon } from '../../components/ItemIcon';
import { ItemPathRow } from '../../components/ItemPathRow';
import { ItemRow } from '../../components/ItemRow';
import { ItemStatusMark } from '../../components/ItemStatusMark';
import { ItemTag } from '../../components/ItemTag';
import type { MenuEntry } from '../../lib/actions';
import { Arrivals } from '../../lib/arrivals';
import { MAIN_FOCUS } from '../../lib/mainFocus';
import { holdBackMenuKeyRelease, isListMenuKey, openContextMenuOf } from '../../lib/rowMenu';
import { isModPressed } from '../../lib/shortcuts';
import { selectOnArrow, selectOnClick, type SelectionState } from '../../lib/selection';
import { treeArrowMove } from '../../lib/treeArrowMove';
import { Checkbox, type CheckState } from '../../ui/Checkbox';
import { Highlight } from '../../ui/Highlight';
import { ActionContextMenu } from '../../ui/menu/ActionContextMenu';
import { ActionDropdownMenu } from '../../ui/menu/ActionDropdownMenu';
import { changePresence, changeStatus, changeTone } from './changeTone';
import { changeTreeArrowRows, menuTargetOf, rowCheckState, rowIndent, treeLevel, type ChangeRow } from './changeRows';
import { LockMark } from './locks/LockMark';
import type { PendingLock, PendingLocks } from './locks/pendingLocks';
import { isReviewKey, toggleReviewedFromKey } from '../review/reviewKey';
import { groupReviewStatus, type ReviewStatus, type ReviewStatusOf } from '../review/reviewStatus';
import { ReviewToggle } from '../review/ReviewToggle';
import type { ListReview } from '../review/useReviewMode';
import { useChangelistDrop } from './useChangelistDrop';
import styles from './ChangesList.module.css';

const ROW_HEIGHT = 28;
/** A little longer than the row-enter animation. */
const ARRIVAL_WINDOW_MS = 600;
/** Vim-style moves, next to the arrows. */
const LETTER_STEPS: Record<string, number> = { j: 1, k: -1 };

interface ChangesListProps {
  rows: ChangeRow[];
  selection: SelectionState;
  onSelectionChange: (selection: SelectionState) => void;
  /** Whether a change goes into the check-in. */
  isIncluded: (change: PendingChange) => boolean;
  /** Checks or unchecks what the rows stand for, all at once. */
  onToggleIncluded: (rows: ChangeRow[], included: boolean) => void;
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
  isIncluded,
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
  // The keyboard moves through every row (`rowKeys`), folders and changelists too, so ← and → can close and open them.
  // Every arrow key renders the list: rows are found by key, never searched for.
  const { changeRows, orderedKeys, rowKeys, rowIndexes } = useMemo(() => indexRows(rows), [rows]);
  // The row keyboard moves go from; Shift extends the selection from the anchor to it.
  const [focusedKey, setFocusedKey] = useState<string | null>(null);
  const focused = focusedKey !== null && rowIndexes.has(focusedKey) ? focusedKey : selection.anchor;
  const grouped = useMemo(() => rows.some((row) => row.type === 'group'), [rows]);
  // Files that just appeared among the changes (saved, created) fade in once.
  const [arrivals] = useState(() => new Arrivals(ARRIVAL_WINDOW_MS));
  const arrived = arrivals.update(orderedKeys, performance.now());
  // Folders or changelists make it a tree for screen readers; otherwise it's a plain list of files.
  const isTree = changeRows.length < rows.length;
  const rowIdPrefix = useId();
  const focusedIndex = focused === null ? -1 : (rowIndexes.get(focused) ?? -1);
  const focusedRow = rows[focusedIndex];
  // A folder's check and mark go over everything in it: worked out once per row, not on every arrow key.
  const checkStateOf = useMemo(() => perRow((row) => rowCheckState(row, isIncluded)), [rows, isIncluded]);
  const reviewStatusOf = useMemo(() => perRow((row) => (review.on ? rowReviewStatus(row, review.statusOf) : null)), [rows, review.on, review.statusOf]);

  // A plain press on a row of a multi-selection keeps the selection until release, so the whole of it can be dragged.
  const narrowOnClick = useRef<string | null>(null);
  // A folder or changelist right-clicked: the menu is for what it holds, not for the files selected elsewhere.
  const menuRow = useRef<ChangeRow | null>(null);

  // Rows of files and folders take stable callbacks, so moving through them re-renders none of them.
  const latest = useRef({ onToggleIncluded, review });
  latest.current = { onToggleIncluded, review };
  const rowActions = useMemo<RowActions>(
    () => ({
      toggleIncluded: (targets, included) => latest.current.onToggleIncluded(targets, included),
      toggleReviewed: (changes) => latest.current.review.toggle(changes),
    }),
    [],
  );

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => viewportRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 16,
  });

  const selectedChanges = (): PendingChange[] => changeRows.filter((row) => selection.selected.has(row.key)).map((row) => row.change);
  const menuEntries = (): MenuEntry[] => {
    const target = menuTargetOf(menuRow.current);
    if (target === null) return contextMenu(selectedChanges());
    return Array.isArray(target) ? contextMenu(target) : changelistMenu(target);
  };
  const { dragProps, dropProps, dropTarget } = useChangelistDrop({ selection, onSelectionChange, selectedChanges, onMoveToChangelist });

  const moveSteps = (key: string): number | undefined => {
    const page = Math.max(1, Math.floor((viewportRef.current?.clientHeight ?? 0) / ROW_HEIGHT) - 1);
    const steps: Record<string, number> = { ArrowDown: 1, ArrowUp: -1, PageDown: page, PageUp: -page, Home: -Infinity, End: Infinity };
    return steps[key];
  };

  const moveBy = (step: number, extend: boolean): void => {
    const moved = selectOnArrow(selection, rowKeys, step, extend, focused);
    if (!moved) return;
    setFocusedKey(moved.focused);
    onSelectionChange(moved.state);
    virtualizer.scrollToIndex(rowIndexes.get(moved.focused) ?? -1);
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    const plain = !event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey;
    const step = moveSteps(event.key) ?? (plain ? LETTER_STEPS[event.key] : undefined);
    if (step !== undefined) {
      event.preventDefault();
      moveBy(step, event.shiftKey);
    } else if ((event.key === 'ArrowLeft' || event.key === 'ArrowRight') && plain) {
      const move = treeArrowMove(changeTreeArrowRows(rows), focusedIndex, event.key);
      if (!move) return;
      event.preventDefault();
      if (move.kind === 'toggle') onToggleCollapsed(focusedRow!.key);
      else moveBy(move.step, false);
    } else if (isReviewKey(event)) {
      event.preventDefault();
      toggleReviewedFromKey(review, selectedChanges(), () => moveBy(1, false));
    } else if (event.key === ' ') {
      event.preventDefault();
      const selectedRows = changeRows.filter((row) => selection.selected.has(row.key));
      const focusedState = focusedRow && checkStateOf(focusedRow);
      if (selectedRows.length === 0 && focusedRow && focusedRow.type !== 'change' && focusedState !== null) {
        onToggleIncluded([focusedRow], focusedState !== true);
        return;
      }
      const include = selectedRows.some((row) => checkStateOf(row) !== true);
      onToggleIncluded(selectedRows, include);
    } else if (event.key === 'a' && isModPressed(event)) {
      event.preventDefault();
      onSelectionChange({ selected: new Set(orderedKeys), anchor: orderedKeys[0] ?? null });
    } else if (event.key === 'Enter' && focusedRow) {
      if (focusedRow.type === 'change') onOpen(focusedRow.change);
      else onToggleCollapsed(focusedRow.key);
    } else if (focusedIndex !== -1 && isListMenuKey(event)) {
      // At the focused row, where the browser would open it at the list's middle.
      event.preventDefault();
      openContextMenuOf(document.getElementById(`${rowIdPrefix}-${focusedIndex}`));
    }
  };

  const onRowMouseDown = (row: ChangeRow, event: MouseEvent): void => {
    if (row.type !== 'change') {
      if (event.button !== 0) return;
      // Selected like a file, so the keyboard goes on from it.
      setFocusedKey(row.key);
      onSelectionChange({ selected: new Set([row.key]), anchor: row.key });
      onToggleCollapsed(row.key);
      return;
    }
    if (event.button === 2 && selection.selected.has(row.key)) return;
    const toggle = isModPressed(event);
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
    <ActionContextMenu entries={menuEntries}>
      <div
        ref={viewportRef}
        className={styles.list}
        tabIndex={0}
        role={isTree ? 'tree' : 'listbox'}
        aria-label="Pending changes"
        aria-multiselectable
        aria-activedescendant={focusedIndex === -1 ? undefined : `${rowIdPrefix}-${focusedIndex}`}
        onKeyDown={onKeyDown}
        onKeyUp={holdBackMenuKeyRelease}
        // From the keyboard, the menu is for the folder or changelist focused; a right-click on a row says which below.
        onContextMenuCapture={() => (menuRow.current = focusedRow && focusedRow.type !== 'change' ? focusedRow : null)}
        {...MAIN_FOCUS}
      >
        <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
          {virtualizer.getVirtualItems().map((item) => {
            const row = rows[item.index]!;
            return (
              <div
                key={row.key}
                id={`${rowIdPrefix}-${item.index}`}
                role={isTree ? 'treeitem' : 'option'}
                aria-level={isTree ? treeLevel(row, grouped) : undefined}
                aria-expanded={row.type === 'change' ? undefined : !row.collapsed}
                aria-selected={selection.selected.has(row.key)}
                className={styles.row}
                data-type={row.type}
                data-selected={selection.selected.has(row.key)}
                data-joins-above={selection.selected.has(row.key) && selection.selected.has(rows[item.index - 1]?.key ?? '')}
                data-joins-below={selection.selected.has(row.key) && selection.selected.has(rows[item.index + 1]?.key ?? '')}
                data-focused={row.key === focused}
                data-arrived={arrived.has(row.key) || undefined}
                data-drop-target={dropTarget === row.key}
                style={{ top: item.start, height: ROW_HEIGHT, '--row-indent': `${rowIndent(row, grouped)}px` } as CSSProperties}
                onMouseDown={(event) => onRowMouseDown(row, event)}
                onClick={() => onRowClick(row)}
                onDoubleClick={() => row.type === 'change' && onOpen(row.change)}
                onContextMenu={() => (menuRow.current = row.type === 'change' ? null : row)}
                {...dragProps(row)}
                {...dropProps(row)}
              >
                {row.type === 'group' ? (
                  <GroupRowContent row={row} checkState={checkStateOf(row)} onToggleIncluded={onToggleIncluded} changelistMenu={changelistMenu} />
                ) : (
                  <ItemRowContent
                    row={row}
                    checkState={checkStateOf(row)}
                    reviewStatus={reviewStatusOf(row)}
                    lock={row.type === 'change' ? locks.get(row.change.path) : undefined}
                    actions={rowActions}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </ActionContextMenu>
  );
}

/** The rows of files and their keys, every row's key, and where each key is: in one pass over tens of thousands of rows. */
function indexRows(rows: ChangeRow[]) {
  const changeRows: (ChangeRow & { type: 'change' })[] = [];
  const orderedKeys: string[] = [];
  const rowKeys: string[] = [];
  const rowIndexes = new Map<string, number>();
  rows.forEach((row, index) => {
    rowKeys.push(row.key);
    rowIndexes.set(row.key, index);
    if (row.type !== 'change') return;
    changeRows.push(row);
    orderedKeys.push(row.key);
  });
  return { changeRows, orderedKeys, rowKeys, rowIndexes };
}

/** A file's mark, or a folder's once every file in it is reviewed; changelist headers have none. */
function rowReviewStatus(row: ChangeRow, statusOf: ReviewStatusOf<PendingChange>): ReviewStatus | null {
  if (row.type === 'change') return statusOf(row.change);
  return row.type === 'directory' ? groupReviewStatus(row.changes, statusOf) : null;
}

/** `of`, remembered for each row it's asked about. */
function perRow<T>(of: (row: ChangeRow) => T): (row: ChangeRow) => T {
  const known = new Map<ChangeRow, T>();
  return (row) => {
    if (!known.has(row)) known.set(row, of(row));
    return known.get(row)!;
  };
}

/** What a row of a file or folder does, stable across renders. */
interface RowActions {
  toggleIncluded: ChangesListProps['onToggleIncluded'];
  toggleReviewed: (changes: PendingChange[]) => void;
}

type GroupRow = ChangeRow & { type: 'group' };

/** A changelist's header: its check, name, actions and count. */
function GroupRowContent({ row, checkState, onToggleIncluded, changelistMenu }: { row: GroupRow; checkState: CheckState | null } & Pick<ChangesListProps, 'onToggleIncluded' | 'changelistMenu'>) {
  return (
    <>
      <ChevronRight size={13} className={styles.chevron} data-collapsed={row.collapsed} />
      <RowCheckbox row={row} checkState={checkState} label={row.label} onToggleIncluded={onToggleIncluded} />
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
}

interface ItemRowContentProps {
  row: Exclude<ChangeRow, GroupRow>;
  /** Null when nothing it stands for can be checked in. */
  checkState: CheckState | null;
  /** Null outside review mode. */
  reviewStatus: ReviewStatus | null;
  lock?: PendingLock;
  actions: RowActions;
}

/** A file or folder as every list shows one (`ItemRow`), after its check (and a folder's chevron). */
const ItemRowContent = memo(function ItemRowContent({ row, checkState, reviewStatus, lock, actions }: ItemRowContentProps) {
  if (row.type === 'directory') {
    return (
      <>
        <ChevronRight size={13} className={styles.chevron} data-collapsed={row.collapsed} />
        <RowCheckbox row={row} checkState={checkState} label={row.name} onToggleIncluded={actions.toggleIncluded} />
        {/* Every folder here holds changes, so only its own change marks it. */}
        <ItemRow
          icon={<ItemIcon itemType="directory" name={row.name} />}
          label={
            <span className={styles.directoryName} data-tip={row.name.includes('/') ? row.name : undefined}>
              <Highlight text={row.name} />
            </span>
          }
          extras={reviewStatus && <ReviewToggle folder status={reviewStatus} onToggle={() => actions.toggleReviewed(row.changes)} />}
          status={<ItemStatusMark status={row.change && changeStatus(row.change)} />}
          presence={row.change ? changePresence(row.change) : 'controlled'}
          deleted={row.change && changeTone(row.change) === 'deleted'}
          faded={reviewStatus === 'reviewed'}
        />
      </>
    );
  }
  const { change } = row;
  return (
    <>
      {checkState !== null ? (
        <Checkbox checked={checkState} onChange={(checked) => actions.toggleIncluded([row], checked)} ariaLabel="Include in the check in" focusable={false} />
      ) : (
        <span className={styles.checkboxPlaceholder} />
      )}
      <ItemPathRow
        path={change.path}
        itemType={change.itemType}
        nameOnly={row.depth > 0}
        oldPath={change.oldPath}
        status={changeStatus(change)}
        presence={changePresence(change)}
        faded={reviewStatus === 'reviewed'}
        extras={
          <>
            {change.mergeInfo && <ItemTag>{change.mergeInfo}</ItemTag>}
            {change.kinds.includes('moved') && change.kinds.includes('changed') && <ItemTag>modified</ItemTag>}
            {reviewStatus && <ReviewToggle status={reviewStatus} onToggle={() => actions.toggleReviewed([change])} />}
            {lock && <LockMark lock={lock} />}
          </>
        }
      />
    </>
  );
});

/** A changelist's or folder's checkbox, or its room when nothing in it can be checked in. */
function RowCheckbox({ row, checkState, label, onToggleIncluded }: { row: ChangeRow; checkState: CheckState | null; label: string } & Pick<ChangesListProps, 'onToggleIncluded'>) {
  if (checkState === null) return <span className={styles.checkboxPlaceholder} />;
  return <Checkbox checked={checkState} onChange={(checked) => onToggleIncluded([row], checked)} ariaLabel={`Include ${label}`} focusable={false} />;
}
