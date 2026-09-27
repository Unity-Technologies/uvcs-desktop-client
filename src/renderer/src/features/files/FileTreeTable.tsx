import { ChevronRight } from 'lucide-react';
import type { TreeItem } from '@shared/domain/explorer';
import type { MenuEntry } from '../../lib/actions';
import { formatSize } from '../../lib/formatDate';
import type { SelectionState } from '../../lib/selection';
import { Avatar } from '../../ui/Avatar';
import { Highlight } from '../../ui/Highlight';
import { RelativeTime } from '../../ui/RelativeTime';
import { Spinner } from '../../ui/Spinner';
import { DataTable, type Column } from '../../ui/table/DataTable';
import { indentOf, treeArrowMove, type FileTreeRow } from './fileTreeRows';
import { ItemIcon } from './ItemIcon';
import { iconOverlay, type ItemStatus } from './itemStatus';
import { isWorkspaceRoot } from './workspaceRoot';
import { XlinkChip } from './XlinkChip';
import styles from './FileTreeTable.module.css';

interface FileTreeTableProps {
  rows: FileTreeRow[];
  selection: SelectionState;
  onSelectionChange: (selection: SelectionState) => void;
  onToggleDirectory: (directory: string) => void;
  /** Double click or Enter on a file. */
  onOpenFile: (item: TreeItem) => void;
  contextMenu: (selected: TreeItem[]) => MenuEntry[];
  /** Pending status per item; the Status column is hidden when omitted. */
  statusOf?: (item: TreeItem) => ItemStatus | null;
  /** Marks directories that contain pending changes. */
  hasChangesInside?: (directory: string) => boolean;
  revealPath?: string | null;
}

/** A virtualized, lazily expanded file tree with revision columns. */
export function FileTreeTable({
  rows,
  selection,
  onSelectionChange,
  onToggleDirectory,
  onOpenFile,
  contextMenu,
  statusOf,
  hasChangesInside,
  revealPath,
}: FileTreeTableProps) {
  const columns: Column<FileTreeRow>[] = [
    {
      id: 'name',
      header: 'Name',
      render: (row) => (
        <NameCell row={row} status={statusOf?.(row.item) ?? null} changesInside={hasChangesInside?.(row.item.path) ?? false} onToggle={onToggleDirectory} />
      ),
    },
    ...(statusOf
      ? [{ id: 'status', header: 'Status', width: 104, secondary: true, render: (row: FileTreeRow) => statusOf(row.item)?.label ?? '' }]
      : []),
    {
      id: 'size',
      header: 'Size',
      width: 72,
      align: 'end',
      secondary: true,
      hideBelow: 560,
      render: (row) => {
        const onDisk = statusOf?.(row.item)?.onDisk;
        return onDisk ? formatSize(onDisk.size) : hasKnownSize(row.item) ? formatSize(row.item.size) : '';
      },
    },
    {
      id: 'date',
      header: 'Modified',
      width: 116,
      secondary: true,
      hideBelow: 520,
      render: (row) => {
        const date = statusOf?.(row.item)?.onDisk?.date || row.item.date;
        return date && <RelativeTime date={date} />;
      },
    },
    {
      id: 'changeset',
      header: 'Changeset',
      width: 88,
      align: 'end',
      secondary: true,
      hideBelow: 640,
      render: (row) => (row.item.changeset > 0 ? row.item.changeset : ''),
    },
    { id: 'owner', header: 'By', width: 44, hideBelow: 600, render: (row) => row.item.owner && <Avatar user={row.item.owner} size={18} /> },
  ];

  const onRowKeyDown = (event: React.KeyboardEvent, row: FileTreeRow, moveBy: (step: number) => void): void => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    const move = treeArrowMove(rows, rows.indexOf(row), event.key);
    if (!move) return;
    event.preventDefault();
    if (move.kind === 'toggle') onToggleDirectory(row.item.path);
    else moveBy(move.step);
  };

  return (
    <DataTable
      rows={rows}
      columns={columns}
      rowKey={(row) => row.item.path}
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
  status: ItemStatus | null;
  changesInside: boolean;
  onToggle: (directory: string) => void;
}

function NameCell({ row, status, changesInside, onToggle }: NameCellProps) {
  const { item } = row;
  const isDirectory = item.itemType === 'directory';

  return (
    <span className={styles.name} style={{ paddingLeft: indentOf(row.depth) }}>
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
      <ItemIcon item={item} expanded={row.isExpanded} overlay={iconOverlay(item, status)} />
      <span className={styles.text}>
        <span className={styles.label} data-private={item.isPrivate} data-root={isWorkspaceRoot(item)}>
          <Highlight text={item.name} />
        </span>
        {item.xlink && <XlinkChip xlink={item.xlink} />}
      </span>
      {!status && changesInside && !isWorkspaceRoot(item) && <span className={styles.changesDot} data-tip="Contains pending changes" />}
    </span>
  );
}

/** `cm ls` reports 0 bytes for items that are added but not checked in yet. */
function hasKnownSize(item: TreeItem): boolean {
  return item.itemType !== 'directory' && (item.isPrivate || item.revisionId > 0);
}
