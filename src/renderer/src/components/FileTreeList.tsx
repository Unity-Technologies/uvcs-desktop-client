import type { KeyboardEvent, ReactNode } from 'react';
import type { MenuEntry } from '../lib/actions';
import { groupedRowLevel, groupedTreeKeyMove, isGroupedList, type GroupedTreeRow, type TreeGroupRow } from '../lib/groupedPathTree';
import { itemsUnderRows, type PathTreeRow } from '../lib/pathTree';
import type { SelectionState } from '../lib/selection';
import { HighlightQuery } from '../ui/Highlight';
import { ListSkeleton } from '../ui/Skeleton';
import type { Column } from '../ui/table/column';
import { DataTable } from '../ui/table/DataTable';
import { FileTreeCell } from './FileTreeCell';
import { TreeGroupLabel } from './TreeGroupLabel';
import styles from './FileTreeList.module.css';

interface FileTreeListProps<T, G> {
  /** The rows shown, as a list or a tree, grouped or not (`useGroupedFileTree`, `useFileTree`). */
  rows: GroupedTreeRow<T, G>[];
  tree: boolean;
  toggleCollapsed: (key: string) => void;
  /** A folder's or a file's row; `level` is how far in it sits, for its `FileTreeCell`. */
  renderItem: (row: PathTreeRow<T>, level: number) => ReactNode;
  /** What a group is, as its tooltip. */
  groupTip?: (group: G) => string | undefined;
  /** The filter's text, marked in the rows. */
  query: string;
  /** Under the filter bar, e.g. the review bar: what its `actions` open, right beneath them. */
  belowFilterBar?: ReactNode;
  /** The filter's field, status chips, List/Tree menu and the list's `actions` (`useChangeFilter`). */
  filterBar: ReactNode;
  selection: SelectionState;
  onSelectionChange: (selection: SelectionState) => void;
  /** The menu of the selected rows, for every item they stand for: a folder's or a group's, all it holds. */
  contextMenu?: (items: T[]) => MenuEntry[];
  /** Keys of the list's own (e.g. the review key), on the selected rows' items; true when handled. */
  onItemsKeyDown?: (event: KeyboardEvent, selectedItems: T[], moveBy: (step: number) => void) => boolean;
  /** J and K move like ↓ and ↑, for lists read one file after another. */
  letterMoves?: boolean;
  /** For screen readers: what the files are ("Changed files"). */
  label: string;
  /** The files are still being read: placeholder rows, at the real row height, under the filter bar. */
  loading?: boolean;
  /** Under the filter bar while the filters hide every file: `NoMatches`. */
  noMatches?: ReactNode;
}

const rowKey = <T, G>(row: GroupedTreeRow<T, G>): string => row.key;
const ROW_HEIGHT = 28;

/**
 * Every list of changed files: the filter bar, then the files as a list or a tree, in groups or not, with a desktop
 * list's selection (several rows, Shift, ⌘/Ctrl) and their menu. A click, Enter, ← and → open and close groups and folders.
 */
export function FileTreeList<T, G>({
  rows,
  tree,
  toggleCollapsed,
  renderItem,
  groupTip,
  query,
  belowFilterBar,
  filterBar,
  selection,
  onSelectionChange,
  contextMenu,
  onItemsKeyDown,
  letterMoves = false,
  label,
  loading = false,
  noMatches,
}: FileTreeListProps<T, G>) {
  const grouped = isGroupedList(rows);
  const columns: Column<GroupedTreeRow<T, G>>[] = [
    {
      id: 'path',
      header: 'File',
      render: (row) => (row.type === 'group' ? <GroupRow row={row} tip={groupTip?.(row.group)} /> : renderItem(row, groupedRowLevel(row, grouped))),
    },
  ];

  const onRowKeyDown = (event: KeyboardEvent, focused: GroupedTreeRow<T, G>, moveBy: (step: number) => void): void => {
    if (onItemsKeyDown?.(event, itemsUnderRows(rows.filter((row) => selection.selected.has(row.key))), moveBy)) return;
    const move = groupedTreeKeyMove(rows, rows.indexOf(focused), event.key);
    if (!move) return;
    event.preventDefault();
    if (move.kind === 'toggle') toggleCollapsed(focused.key);
    else moveBy(move.step);
  };

  return (
    <div className={styles.list}>
      {filterBar}
      {belowFilterBar}
      {loading ? (
        <ListSkeleton rowHeight={ROW_HEIGHT} />
      ) : (
        <HighlightQuery query={query}>
          <DataTable
            rows={rows}
            columns={columns}
            rowKey={rowKey}
            selection={selection}
            onSelectionChange={onSelectionChange}
            // The list may open on a file far down (the one clicked elsewhere), and filtering keeps it in view.
            revealKey={selection.anchor}
            contextMenu={contextMenu && ((selected) => contextMenu(itemsUnderRows(selected)))}
            rowHeight={ROW_HEIGHT}
            letterMoves={letterMoves}
            onRowPressed={(row) => row.type !== 'file' && toggleCollapsed(row.key)}
            onRowKeyDown={onRowKeyDown}
            hideHeader
            label={tree ? `${label}, by folder` : label}
            empty={noMatches}
          />
        </HighlightQuery>
      )}
    </div>
  );
}

function GroupRow<T, G>({ row, tip }: { row: TreeGroupRow<T, G>; tip?: string }) {
  return (
    <FileTreeCell depth={0} tree folder>
      <TreeGroupLabel label={row.label} collapsed={row.collapsed} count={row.items.length} tip={tip} />
    </FileTreeCell>
  );
}
