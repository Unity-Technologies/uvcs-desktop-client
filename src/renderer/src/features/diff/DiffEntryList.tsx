import type { KeyboardEvent, ReactNode } from 'react';
import type { DiffEntry } from '@shared/domain/diff';
import { ItemPathRow } from '../../components/ItemPathRow';
import { ItemTag } from '../../components/ItemTag';
import type { MenuEntry } from '../../lib/actions';
import type { SelectionState } from '../../lib/selection';
import { HighlightQuery } from '../../ui/Highlight';
import type { Column } from '../../ui/table/column';
import { DataTable } from '../../ui/table/DataTable';
import { isReviewKey, toggleReviewedFromKey } from '../review/reviewKey';
import { ReviewToggle } from '../review/ReviewToggle';
import type { ReviewMode } from '../review/useReviewMode';
import { describeDiffEntry, diffEntryTone, isMovedAndChanged } from './diffEntrySources';
import styles from './DiffEntryList.module.css';

interface DiffEntryListProps {
  /** The files shown: the filter's and review mode's. */
  rows: DiffEntry[];
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

function columns({ on, statusOf, toggle }: ReviewMode<DiffEntry>): Column<DiffEntry>[] {
  const reviewStatus = (entry: DiffEntry) => (on ? statusOf(entry) : null);
  return [
    {
      id: 'path',
      header: 'File',
      render: (entry) => {
        const status = reviewStatus(entry);
        return (
          <ItemPathRow
            path={entry.path}
            itemType={entry.itemType}
            oldPath={entry.oldPath}
            status={{ tone: diffEntryTone(entry), label: describeDiffEntry(entry) }}
            faded={status === 'reviewed'}
            extras={
              <>
                {isMovedAndChanged(entry) && <ItemTag>modified</ItemTag>}
                {status && <ReviewToggle status={status} onToggle={() => toggle([entry])} />}
              </>
            }
          />
        );
      },
    },
  ];
}

/** The files of a diff: filterable, and in review mode marked as they are reviewed. */
export function DiffEntryList({ rows, query, filterBar, selection, onSelectionChange, contextMenu, review }: DiffEntryListProps) {
  const onRowKeyDown = (event: KeyboardEvent, _focused: DiffEntry, moveBy: (step: number) => void): void => {
    if (!isReviewKey(event)) return;
    event.preventDefault();
    toggleReviewedFromKey(review, rows.filter((entry) => selection.selected.has(diffEntryKey(entry))), () => moveBy(1));
  };

  return (
    <div className={styles.list}>
      {review.bar}
      {filterBar}
      <HighlightQuery query={query}>
        <DataTable
          rows={rows}
          columns={columns(review)}
          rowKey={diffEntryKey}
          selection={selection}
          onSelectionChange={onSelectionChange}
          // The diff may open on a file far down a long list (the one clicked in a details panel), and filtering keeps it in view.
          revealKey={selection.anchor}
          contextMenu={contextMenu}
          rowHeight={28}
          letterMoves
          onRowKeyDown={onRowKeyDown}
          hideHeader
        />
      </HighlightQuery>
    </div>
  );
}
