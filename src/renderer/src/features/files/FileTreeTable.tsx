import { ChevronRight, File, FileImage, Folder, FolderOpen, Link2 } from 'lucide-react';
import type { TreeItem } from '@shared/domain/explorer';
import { StatusBadge } from '../../components/StatusBadge';
import type { MenuEntry } from '../../lib/actions';
import { formatSize } from '../../lib/formatDate';
import type { SelectionState } from '../../lib/selection';
import { Avatar } from '../../ui/Avatar';
import { Highlight } from '../../ui/Highlight';
import { RelativeTime } from '../../ui/RelativeTime';
import { Spinner } from '../../ui/Spinner';
import { DataTable, type Column } from '../../ui/table/DataTable';
import type { FileTreeRow } from './fileTreeRows';
import type { ItemStatus } from './itemStatus';
import styles from './FileTreeTable.module.css';

const INDENT = 16;
const IMAGE_EXTENSION = /\.(png|jpe?g|gif|bmp|webp|psd|tga|exr|ico)$/i;

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
      render: (row) => (hasKnownSize(row.item) ? formatSize(row.item.size) : ''),
    },
    { id: 'date', header: 'Modified', width: 116, secondary: true, render: (row) => row.item.date && <RelativeTime date={row.item.date} /> },
    {
      id: 'changeset',
      header: 'Changeset',
      width: 88,
      align: 'end',
      secondary: true,
      hideBelow: 640,
      render: (row) => (row.item.changeset > 0 ? row.item.changeset : ''),
    },
    { id: 'owner', header: '', width: 40, render: (row) => row.item.owner && <Avatar user={row.item.owner} size={18} /> },
  ];

  const onRowKeyDown = (event: React.KeyboardEvent, row: FileTreeRow): void => {
    if (row.item.itemType !== 'directory') return;
    const shouldToggle = (event.key === 'ArrowRight' && !row.isExpanded) || (event.key === 'ArrowLeft' && row.isExpanded);
    if (shouldToggle) {
      event.preventDefault();
      onToggleDirectory(row.item.path);
    }
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
    <span className={styles.name} style={{ paddingLeft: row.depth * INDENT }}>
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
      <ItemIcon item={item} expanded={row.isExpanded} />
      <span className={styles.label} data-private={item.isPrivate}>
        <Highlight text={item.name} />
      </span>
      {status && <StatusBadge tone={status.tone} title={status.label} />}
      {!status && changesInside && <span className={styles.changesDot} data-tip="Contains pending changes" />}
    </span>
  );
}

function ItemIcon({ item, expanded }: { item: TreeItem; expanded: boolean }) {
  if (item.itemType === 'directory') {
    const Icon = expanded ? FolderOpen : Folder;
    return <Icon size={14} className={styles.folderIcon} />;
  }
  if (item.itemType === 'xlink') return <Link2 size={14} className={styles.fileIcon} />;
  if (IMAGE_EXTENSION.test(item.name)) return <FileImage size={14} className={styles.fileIcon} />;
  return <File size={14} className={styles.fileIcon} />;
}

/** `cm ls` reports 0 bytes for items that are added but not checked in yet. */
function hasKnownSize(item: TreeItem): boolean {
  return item.itemType !== 'directory' && (item.isPrivate || item.revisionId > 0);
}
