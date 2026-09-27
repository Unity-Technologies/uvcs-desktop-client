import { ChevronRight } from 'lucide-react';
import type { TreeItem } from '@shared/domain/explorer';
import type { MenuEntry } from '../../lib/actions';
import type { SelectionState } from '../../lib/selection';
import { Highlight } from '../../ui/Highlight';
import { RelativeTime } from '../../ui/RelativeTime';
import { Spinner } from '../../ui/Spinner';
import { DataTable, type Column } from '../../ui/table/DataTable';
import { hotkey, hotkeys } from '../../lib/shortcutRegistry';
import { matchesShortcut } from '../../lib/shortcuts';
import { treeArrowMove } from '../../lib/treeArrowMove';
import { fileTreeArrowRows, indentOf, type FileTreeRow } from './fileTreeRows';
import { ItemIcon } from '../../components/ItemIcon';
import { ItemRow } from '../../components/ItemRow';
import { ItemStatusMark } from '../../components/ItemStatusMark';
import { LockChip } from '../pendingChanges/locks/LockChip';
import { itemDecoration, type ItemDecoration } from './itemDecoration';
import type { ItemStatus } from './itemStatus';
import type { PendingLock } from '../pendingChanges/locks/pendingLocks';
import { isWorkspaceRoot } from './workspaceRoot';
import { XlinkChip } from './XlinkChip';
import styles from './FileTreeTable.module.css';

/** Below this width the tree shows names only: a deep path's name needs the room more than its date. */
const MODIFIED_COLUMN_MIN_WIDTH = 420;

/** Stable, so the table doesn't re-key every row on each render (a selection change). */
const rowKey = (row: FileTreeRow): string => row.item.path;

interface FileTreeTableProps {
  rows: FileTreeRow[];
  selection: SelectionState;
  onSelectionChange: (selection: SelectionState) => void;
  onToggleDirectory: (directory: string) => void;
  /** Double click or Enter on a file. */
  onOpenFile: (item: TreeItem) => void;
  contextMenu: (selected: TreeItem[]) => MenuEntry[];
  /** Pending status per item, for a workspace tree; without it the tree is a repository's, where nothing is pending. */
  statusOf?: (item: TreeItem) => ItemStatus | null;
  /** The lock on an item's pending change. */
  lockOf?: (item: TreeItem) => PendingLock | undefined;
  /** Marks directories that contain pending changes. */
  hasChangesInside?: (directory: string) => boolean;
  revealPath?: string | null;
  /** Items cut to move elsewhere, shown ghosted. */
  isCut?: (item: TreeItem) => boolean;
  /** "/" in the tree: to the view's find field. */
  onFind?: () => void;
}

/** A virtualized, lazily expanded file tree: each item's icon, badge and name, and when it last changed. */
export function FileTreeTable({
  rows,
  selection,
  onSelectionChange,
  onToggleDirectory,
  onOpenFile,
  contextMenu,
  statusOf,
  lockOf,
  hasChangesInside,
  revealPath,
  isCut,
  onFind,
}: FileTreeTableProps) {
  // Name and when it last changed: the rest (size, changeset, author, comment) is the selected item's, on its pane.
  const columns: Column<FileTreeRow>[] = [
    {
      id: 'name',
      header: 'Name',
      render: (row) => (
        <NameCell
          row={row}
          decoration={itemDecoration(row.item, statusOf?.(row.item) ?? null)}
          lock={lockOf?.(row.item)}
          changesInside={hasChangesInside?.(row.item.path) ?? false}
          isCut={isCut?.(row.item) ?? false}
          onToggle={onToggleDirectory}
        />
      ),
    },
    {
      id: 'date',
      header: 'Modified',
      width: 112,
      secondary: true,
      hideBelow: MODIFIED_COLUMN_MIN_WIDTH,
      render: (row) => {
        const date = statusOf?.(row.item)?.onDisk?.date || row.item.date;
        return date && <RelativeTime date={date} />;
      },
    },
  ];

  const onRowKeyDown = (event: React.KeyboardEvent, row: FileTreeRow, moveBy: (step: number) => void): void => {
    // ⌘F is the palette command's; the tree adds the plain key.
    if (onFind && hotkeys('filesFind').some((key) => key !== hotkey('filesFind') && matchesShortcut(event.nativeEvent, key))) {
      event.preventDefault();
      onFind();
      return;
    }
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    const move = treeArrowMove(fileTreeArrowRows(rows), rows.indexOf(row), event.key);
    if (!move) return;
    event.preventDefault();
    if (move.kind === 'toggle') onToggleDirectory(row.item.path);
    else moveBy(move.step);
  };

  return (
    <DataTable
      rows={rows}
      columns={columns}
      rowKey={rowKey}
      selection={selection}
      onSelectionChange={onSelectionChange}
      onActivate={(row) => (row.item.itemType === 'directory' ? onToggleDirectory(row.item.path) : onOpenFile(row.item))}
      contextMenu={(selected) => contextMenu(selected.map((row) => row.item))}
      onRowKeyDown={onRowKeyDown}
      revealKey={revealPath}
      rowHeight={28}
    />
  );
}

interface NameCellProps {
  row: FileTreeRow;
  decoration: ItemDecoration;
  lock?: PendingLock;
  changesInside: boolean;
  isCut: boolean;
  onToggle: (directory: string) => void;
}

/** The chevron, then the item as every list shows one (`ItemRow`): its lock and status letter at the end of the row. */
function NameCell({ row, decoration, lock, changesInside, isCut, onToggle }: NameCellProps) {
  const { item } = row;
  const isDirectory = item.itemType === 'directory';
  const { status, presence } = decoration;

  return (
    <span className={styles.name} style={{ paddingLeft: indentOf(row.depth) }} data-cut={isCut || undefined}>
      {isDirectory ? (
        <button
          className={styles.chevron}
          data-expanded={row.isExpanded}
          aria-label={row.isExpanded ? 'Collapse' : 'Expand'}
          onMouseDown={(event) => event.stopPropagation()}
          onClick={() => onToggle(item.path)}
          tabIndex={-1}
        >
          {row.isLoading ? <Spinner size={10} /> : <ChevronRight size={13} />}
        </button>
      ) : (
        <span className={styles.chevronSpace} />
      )}
      <ItemRow
        icon={<ItemIcon itemType={item.itemType} name={item.name} />}
        label={
          <>
            <span className={styles.label} data-root={isWorkspaceRoot(item)}>
              <Highlight text={item.name} />
            </span>
            {item.xlink && <XlinkChip xlink={item.xlink} />}
          </>
        }
        extras={lock && <LockChip path={item.path} lock={lock} />}
        status={<ItemStatusMark status={status} changesInside={changesInside && !isWorkspaceRoot(item)} />}
        presence={presence}
        deleted={status?.tone === 'deleted'}
      />
    </span>
  );
}
