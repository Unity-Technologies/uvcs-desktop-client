import type { KeyboardEvent, ReactNode } from 'react';
import type { DiffEntry } from '@shared/domain/diff';
import { FileTreeList } from '../../components/FileTreeList';
import type { MenuEntry } from '../../lib/actions';
import type { PathTreeRow } from '../../lib/pathTree';
import type { SelectionState } from '../../lib/selection';
import { isReviewKey, toggleReviewedFromKey } from '../review/reviewKey';
import { groupReviewStatus, partialReviewCount } from '../review/reviewStatus';
import { ReviewToggle } from '../review/ReviewToggle';
import type { ReviewMode } from '../review/useReviewMode';
import { DiffEntryRow } from './DiffEntryRow';

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
  /** The diff's files are still being read: placeholder rows under the filter bar. */
  loading?: boolean;
  /** While the filters hide every file: `NoMatches`. */
  noMatches?: ReactNode;
}

export const diffEntryKey = (entry: DiffEntry): string => entry.path;

/** The files of a diff, as a list or a tree: filterable, and in review mode marked as they are reviewed, a folder at a time too. */
export function DiffEntryList({ rows, tree, toggleCollapsed, query, filterBar, selection, onSelectionChange, contextMenu, review, loading, noMatches }: DiffEntryListProps) {
  const { on, statusOf, toggle } = review;

  const renderItem = (row: DiffEntryRowItem, level: number) => {
    if (row.type === 'folder') {
      const status = on ? groupReviewStatus(row.items, statusOf) : null;
      const toggleFolder = status && <ReviewToggle folder status={status} partial={partialReviewCount(row.items, statusOf)} onToggle={() => toggle(row.items)} />;
      return <DiffEntryRow row={row} level={level} tree={tree} extras={toggleFolder} faded={status === 'reviewed'} />;
    }
    const status = on ? statusOf(row.item) : null;
    return <DiffEntryRow row={row} level={level} tree={tree} extras={status && <ReviewToggle status={status} onToggle={() => toggle([row.item])} />} faded={status === 'reviewed'} />;
  };

  const onItemsKeyDown = (event: KeyboardEvent, selected: DiffEntry[], moveBy: (step: number) => void): boolean => {
    if (!isReviewKey(event)) return false;
    event.preventDefault();
    toggleReviewedFromKey(review, selected, () => moveBy(1));
    return true;
  };

  return (
    <FileTreeList
      rows={rows}
      tree={tree}
      toggleCollapsed={toggleCollapsed}
      renderItem={renderItem}
      query={query}
      belowFilterBar={review.bar}
      filterBar={filterBar}
      selection={selection}
      onSelectionChange={onSelectionChange}
      contextMenu={contextMenu}
      onItemsKeyDown={onItemsKeyDown}
      letterMoves
      label="Changed files"
      loading={loading}
      noMatches={noMatches}
    />
  );
}
