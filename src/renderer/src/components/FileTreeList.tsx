import { useMemo, type KeyboardEvent, type ReactNode } from 'react';
import type { MenuEntry } from '../lib/actions';
import { groupedRowLevel, groupedTreeKeyMove, groupLevelsOf, hasChevronColumn, type GroupedTreeRow, type TreeGroupRow } from '../lib/groupedPathTree';
import { rangeLength, type ItemRange } from '../lib/itemRange';
import { itemsUnderRows, type PathTreeRow } from '../lib/pathTree';
import type { SelectionState } from '../lib/selection';
import { HighlightQuery } from '../ui/Highlight';
import { ListSkeleton } from '../ui/Skeleton';
import type { Column } from '../ui/table/column';
import { DataTable } from '../ui/table/DataTable';
import { FileTreeCell, RowGuidesContext } from './FileTreeCell';
import { FileTreeFoldingContext, type FileTreeFolding } from './fileTreeFolding';
import { StatusGroupBadge } from './StatusBadge';
import { isStatusGroup } from './statusGroups';
import { ListToolbar } from './ListToolbar';
import { TreeGroupLabel, type GroupProgress } from './TreeGroupLabel';
import styles from './FileTreeList.module.css';

interface FileTreeListProps<T, G> {
  /** The rows shown, as a list or a tree, grouped or not (`useGroupedFileTree`, `useFileTree`). */
  rows: GroupedTreeRow<T, G>[];
  tree: boolean;
  toggleCollapsed: (key: string) => void;
  /** Closing or opening every group and folder, from the filter bar's view menu; null for a flat list. */
  folding?: FileTreeFolding | null;
  /** A folder's or a file's row; `level` is how far in it sits, for its `FileTreeCell`. */
  renderItem: (row: PathTreeRow<T>, level: number) => ReactNode;
  /** What a group is, as its tooltip. */
  groupTip?: (group: G) => string | undefined;
  /** What a group's header says instead of its count, from the items it holds (`TreeGroupLabel`'s `progress`). */
  groupProgress?: (group: G, held: ItemRange<T>) => GroupProgress | undefined;
  /** Between a group's chevron and its name, from the items it holds: a checkbox for all of them. */
  groupBefore?: (group: G, held: ItemRange<T>) => ReactNode;
  /** The filter's text, marked in the rows. */
  query: string;
  /** Under the filter bar, e.g. the review bar: what its `actions` open, right beneath them. */
  belowFilterBar?: ReactNode;
  /** The filter's field, status chips, view menu and the list's `actions` (`useChangeFilter`). */
  filterBar: ReactNode;
  selection: SelectionState;
  onSelectionChange: (selection: SelectionState) => void;
  /** The menu of the selected rows, for every item they stand for: a folder's or a group's, all it holds. */
  contextMenu?: (items: T[]) => MenuEntry[];
  /** Keys of the list's own (e.g. the review key), on the selected rows' items, the focused row at `focusedIndex` in `rows`; true when handled. */
  onItemsKeyDown?: (event: KeyboardEvent, selectedItems: T[], moveBy: (step: number) => void, focusedIndex: number) => boolean;
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
  folding = null,
  renderItem,
  groupTip,
  groupProgress,
  groupBefore,
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
  const groupLevels = groupLevelsOf(rows);
  const levelOf = (row: GroupedTreeRow<T, G>): number => groupedRowLevel(row, groupLevels);
  const rowGuides = useMemo(() => ({ chevronColumn: hasChevronColumn(groupLevels, tree) }), [groupLevels, tree]);
  const columns: Column<GroupedTreeRow<T, G>>[] = [
    {
      id: 'path',
      header: 'File',
      render: (row) => (
        <RowGuidesContext.Provider value={rowGuides}>
          {row.type === 'group' ? (
            <GroupRow row={row} level={levelOf(row)} tip={groupTip?.(row.group)} progress={groupProgress?.(row.group, row.held)} before={groupBefore?.(row.group, row.held)} />
          ) : (
            renderItem(row, levelOf(row))
          )}
        </RowGuidesContext.Provider>
      ),
    },
  ];

  const onRowKeyDown = (event: KeyboardEvent, focused: GroupedTreeRow<T, G>, moveBy: (step: number) => void): void => {
    if (onItemsKeyDown?.(event, itemsUnderRows(rows.filter((row) => selection.selected.has(row.key))), moveBy, rows.indexOf(focused))) return;
    const move = groupedTreeKeyMove(rows, rows.indexOf(focused), event.key);
    if (!move) return;
    event.preventDefault();
    if (move.kind === 'toggle') toggleCollapsed(focused.key);
    else moveBy(move.step);
  };

  return (
    <div className={styles.list}>
      <FileTreeFoldingContext.Provider value={folding}>
        <ListToolbar>
          {filterBar}
          {belowFilterBar}
        </ListToolbar>
      </FileTreeFoldingContext.Provider>
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

/** A group's header: a status group's leads with its status's badge, as its rows end with it. */
function GroupRow<T, G>({ row, level, tip, progress, before }: { row: TreeGroupRow<T, G>; level: number; tip?: string; progress?: GroupProgress; before?: ReactNode }) {
  return (
    <FileTreeCell depth={level} tree folder>
      <TreeGroupLabel
        label={row.label}
        icon={isStatusGroup(row.group) ? <StatusGroupBadge tone={row.group.status} /> : undefined}
        collapsed={row.collapsed}
        before={before}
        count={rangeLength(row.held)}
        progress={progress}
        tip={tip}
      />
    </FileTreeCell>
  );
}
