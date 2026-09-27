import type { KeyboardEvent } from 'react';
import type { DiffEntry } from '@shared/domain/diff';
import { PathLabel } from '../../components/PathLabel';
import { useChangeFilter } from '../../components/useChangeFilter';
import { StatusBadge } from '../../components/StatusBadge';
import type { MenuEntry } from '../../lib/actions';
import type { SelectionState } from '../../lib/selection';
import { HighlightQuery } from '../../ui/Highlight';
import { DataTable, type Column } from '../../ui/table/DataTable';
import { isReviewKey, toggleReviewedFromKey } from '../review/reviewKey';
import { ReviewToggle } from '../review/ReviewToggle';
import { SinceReviewDot } from '../review/SinceReviewDot';
import type { ReviewMode } from '../review/useReviewMode';
import { describeDiffEntry, diffEntryTone, isMovedAndChanged } from './diffEntrySources';
import styles from './DiffEntryList.module.css';

interface DiffEntryListProps {
  entries: DiffEntry[];
  selection: SelectionState;
  onSelectionChange: (selection: SelectionState) => void;
  contextMenu: (selected: DiffEntry[]) => MenuEntry[];
  review: ReviewMode<DiffEntry>;
}

export const diffEntryKey = (entry: DiffEntry): string => entry.path;

function columns({ on, statusOf, toggle }: ReviewMode<DiffEntry>): Column<DiffEntry>[] {
  const reviewStatus = (entry: DiffEntry) => (on ? statusOf(entry) : null);
  // The status sits next to the path, as in the pending changes: a column of its own would space them a cell apart.
  const pathColumn: Column<DiffEntry> = {
    id: 'path',
    header: 'File',
    render: (entry) => (
      <span className={styles.path} data-review={reviewStatus(entry) ?? undefined}>
        <StatusBadge tone={diffEntryTone(entry)} title={describeDiffEntry(entry)} />
        {reviewStatus(entry) === 'changedSinceReview' && <SinceReviewDot />}
        <PathLabel path={entry.path} oldPath={entry.oldPath} strikethrough={entry.status === 'deleted'} />
        {isMovedAndChanged(entry) && <span className={styles.tag}>modified</span>}
      </span>
    ),
  };
  const reviewColumn: Column<DiffEntry> = {
    id: 'review',
    header: '',
    width: 30,
    render: (entry) => {
      const status = reviewStatus(entry);
      return status && <ReviewToggle status={status} onToggle={() => toggle([entry])} />;
    },
  };
  return on ? [pathColumn, reviewColumn] : [pathColumn];
}

/** The files of a diff: filterable, and in review mode marked as they are reviewed. */
export function DiffEntryList({ entries, selection, onSelectionChange, contextMenu, review }: DiffEntryListProps) {
  const { visible, query, bar } = useChangeFilter(entries, diffEntryKey, diffEntryTone);
  const rows = review.narrow(visible);

  const onRowKeyDown = (event: KeyboardEvent, _focused: DiffEntry, moveBy: (step: number) => void): void => {
    if (!isReviewKey(event)) return;
    event.preventDefault();
    toggleReviewedFromKey(review, rows.filter((entry) => selection.selected.has(diffEntryKey(entry))), () => moveBy(1));
  };

  return (
    <div className={styles.list}>
      {review.bar}
      {bar}
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
