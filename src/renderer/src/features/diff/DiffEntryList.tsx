import type { KeyboardEvent, ReactNode } from 'react';
import type { DiffEntry } from '@shared/domain/diff';
import type { MenuEntry } from '../../lib/actions';
import { itemsUnderRows, pathTreeKeyMove, type PathTreeRow } from '../../lib/pathTree';
import type { SelectionState } from '../../lib/selection';
import { HighlightQuery } from '../../ui/Highlight';
import type { Column } from '../../ui/table/column';
import { DataTable } from '../../ui/table/DataTable';
import { isReviewKey, toggleReviewedFromKey } from '../review/reviewKey';
import { groupReviewStatus, partialReviewCount } from '../review/reviewStatus';
import { ReviewToggle } from '../review/ReviewToggle';
import type { ReviewMode } from '../review/useReviewMode';
import { DiffEntryRow } from './DiffEntryRow';
import styles from './DiffEntryList.module.css';

export type DiffEntryRowItem = PathTreeRow<DiffEntry>;

interface DiffEntryListProps {
  /** The files shown, the filter's and review mode's, as a list or a tree (`useFileTree`). */
  rows: DiffEntryRowItem[];
  tree: boolean;
  toggleCollapsed: (key: string) => void;
  /** The filter's text, marked in the rows. */
  query: string;
  /** The filter's field and chips. */
  filterBar: ReactNode;
  selection: SelectionState;
  onSelectionChange: (selection: SelectionState) => void;
  contextMenu: (selected: DiffEntry[]) => MenuEntry[];
  review: ReviewMode<DiffEntry>;
}

export const diffEntryKey = (entry: DiffEntry): string => entry.path;

const rowKey = (row: DiffEntryRowItem): string => row.key;

function columns({ on, statusOf, toggle }: ReviewMode<DiffEntry>, tree: boolean): Column<DiffEntryRowItem>[] {
  return [
    {
      id: 'path',
      header: 'File',
      render: (row) => {
        if (row.type === 'folder') {
          const status = on ? groupReviewStatus(row.items, statusOf) : null;
          const toggleFolder = status && <ReviewToggle folder status={status} partial={partialReviewCount(row.items, statusOf)} onToggle={() => toggle(row.items)} />;
          return <DiffEntryRow row={row} tree={tree} extras={toggleFolder} faded={status === 'reviewed'} />;
        }
        const status = on ? statusOf(row.item) : null;
        return <DiffEntryRow row={row} tree={tree} extras={status && <ReviewToggle status={status} onToggle={() => toggle([row.item])} />} faded={status === 'reviewed'} />;
      },
    },
  ];
}

/** The files of a diff, as a list or a tree: filterable, and in review mode marked as they are reviewed, a folder at a time too. */
export function DiffEntryList({ rows, tree, toggleCollapsed, query, filterBar, selection, onSelectionChange, contextMenu, review }: DiffEntryListProps) {
  const selectedRows = (): DiffEntryRowItem[] => rows.filter((row) => selection.selected.has(row.key));

  const onRowKeyDown = (event: KeyboardEvent, focused: DiffEntryRowItem, moveBy: (step: number) => void): void => {
    if (isReviewKey(event)) {
      event.preventDefault();
      toggleReviewedFromKey(review, itemsUnderRows(selectedRows()), () => moveBy(1));
      return;
    }
    const move = pathTreeKeyMove(rows, rows.indexOf(focused), event.key);
    if (!move) return;
    event.preventDefault();
    if (move.kind === 'toggle') toggleCollapsed(focused.key);
    else moveBy(move.step);
  };

  return (
    <div className={styles.list}>
      {review.bar}
      {filterBar}
      <HighlightQuery query={query}>
        <DataTable
          rows={rows}
          columns={columns(review, tree)}
          rowKey={rowKey}
          selection={selection}
          onSelectionChange={onSelectionChange}
          // The diff may open on a file far down a long list (the one clicked in a details panel), and filtering keeps it in view.
          revealKey={selection.anchor}
          contextMenu={(selected) => contextMenu(itemsUnderRows(selected))}
          rowHeight={28}
          letterMoves
          onRowPressed={(row) => row.type === 'folder' && toggleCollapsed(row.key)}
          onRowKeyDown={onRowKeyDown}
          hideHeader
          label={tree ? 'Changed files, by folder' : 'Changed files'}
        />
      </HighlightQuery>
    </div>
  );
}
