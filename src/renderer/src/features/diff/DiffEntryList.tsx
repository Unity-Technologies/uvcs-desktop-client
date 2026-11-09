import type { KeyboardEvent, ReactNode } from 'react';
import type { DiffEntry } from '@shared/domain/diff';
import { FileTreeList } from '../../components/FileTreeList';
import type { MenuEntry } from '../../lib/actions';
import type { FileTreeFolding } from '../../components/fileTreeFolding';
import type { StatusGroup } from '../../components/statusGroups';
import type { GroupedTreeRow } from '../../lib/groupedPathTree';
import { itemsIn } from '../../lib/itemRange';
import type { PathTreeRow } from '../../lib/pathTree';
import type { SelectionState } from '../../lib/selection';
import { isReviewKey, toggleReviewedFromKey } from '../review/reviewKey';
import { groupReviewStatus, partialReviewCount } from '../review/reviewStatus';
import { ReviewToggle } from '../review/ReviewToggle';
import type { ReviewMode } from '../review/useReviewMode';
import { DiffEntryRow } from './DiffEntryRow';

export type DiffEntryRowItem = PathTreeRow<DiffEntry>;

interface DiffEntryListProps {
  /** The files shown, the filter's and review mode's, as a list or a tree, by status or not (`useGroupedFileTree`). */
  rows: GroupedTreeRow<DiffEntry, StatusGroup>[];
  tree: boolean;
  toggleCollapsed: (key: string) => void;
  /** Closing or opening every group and folder, from the view menu; null for a flat list. */
  folding: FileTreeFolding | null;
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
  /** The Unity `.meta` each asset's row stands for too (`pairDiffMetas`): tagged "+ meta". */
  metaOf?: (entry: DiffEntry) => DiffEntry | undefined;
  /** What the place puts by a file's status letter (`EntryMarkContext`): a review's comments. */
  markOf?: (entry: DiffEntry) => ReactNode;
}

export const diffEntryKey = (entry: DiffEntry): string => entry.path;

/** The files of a diff, as a list or a tree: filterable, and in review mode marked as they are reviewed, a folder at a time too. */
export function DiffEntryList({ rows, tree, toggleCollapsed, folding, query, filterBar, selection, onSelectionChange, contextMenu, review, loading, noMatches, metaOf = () => undefined, markOf }: DiffEntryListProps) {
  const { on, statusOf, toggle } = review;

  const renderItem = (row: DiffEntryRowItem, level: number) => {
    if (row.type === 'folder') {
      const status = on ? groupReviewStatus(row.held, statusOf) : null;
      const toggleFolder = status && <ReviewToggle folder status={status} partial={partialReviewCount(row.held, statusOf)} onToggle={() => toggle(itemsIn(row.held))} />;
      return <DiffEntryRow row={row} level={level} tree={tree} extras={toggleFolder} faded={status === 'reviewed'} hasMeta={row.item !== undefined && metaOf(row.item) !== undefined} />;
    }
    const status = on ? statusOf(row.item) : null;
    const extras = (
      <>
        {status && <ReviewToggle status={status} onToggle={() => toggle([row.item])} />}
        {markOf?.(row.item)}
      </>
    );
    return <DiffEntryRow row={row} level={level} tree={tree} extras={extras} faded={status === 'reviewed'} hasMeta={metaOf(row.item) !== undefined} />;
  };

  const onItemsKeyDown = (event: KeyboardEvent, selected: DiffEntry[], moveBy: (step: number) => void, focusedIndex: number): boolean => {
    if (!isReviewKey(event)) return false;
    event.preventDefault();
    toggleReviewedFromKey(review, selected, { rows, focusedIndex, moveBy });
    return true;
  };

  return (
    <FileTreeList
      rows={rows}
      tree={tree}
      toggleCollapsed={toggleCollapsed}
      folding={folding}
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
