import type { CodeReviewSummary } from '@shared/domain/codeReview';
import { UserLabel } from '../../ui/Avatar';
import { Highlight } from '../../ui/Highlight';
import { RelativeTime } from '../../ui/RelativeTime';
import type { Column } from '../../ui/table/column';
import { BranchNameCell } from './BranchNameCell';
import type { BranchesLayout } from './branchesViewStore';
import type { BranchTreeRow } from './branchTree';

/**
 * Columns of the branches table. A tree keeps its rows in tree order, so only a list sorts by column; `currentBranch`
 * is marked as the one the workspace is on, and each branch shows its newest code review.
 */
export function branchColumns(
  layout: BranchesLayout,
  currentBranch: string | undefined,
  onToggleCollapsed: (name: string) => void,
  reviews: ReadonlyMap<number, CodeReviewSummary> | undefined,
): Column<BranchTreeRow>[] {
  const sortable = layout === 'list';
  return [
    {
      id: 'name',
      header: 'Name',
      grow: 2,
      sortValue: sortable ? (row) => row.branch.name : undefined,
      render: (row) => (
        <BranchNameCell row={row} isCurrent={row.branch.name === currentBranch} review={reviews?.get(row.branch.id)} onToggleCollapsed={onToggleCollapsed} />
      ),
    },
    // Gives its room to the name in a narrow list: the details panel shows the comment anyway.
    { id: 'comment', header: 'Comment', grow: 2, secondary: true, hideBelow: 560, render: (row) => <Highlight text={row.branch.comment} /> },
    {
      id: 'owner',
      header: 'Created by',
      width: 180,
      hideBelow: 700,
      sortValue: sortable ? (row) => row.branch.owner : undefined,
      render: (row) => <UserLabel user={row.branch.owner} />,
    },
    {
      id: 'date',
      header: 'Created',
      width: 130,
      secondary: true,
      sortValue: sortable ? (row) => row.branch.date : undefined,
      render: (row) => <RelativeTime date={row.branch.date} />,
    },
  ];
}
