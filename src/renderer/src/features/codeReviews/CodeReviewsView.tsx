import { CircleDot, MessageSquareCode, Plus, RefreshCw, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { CODE_REVIEW_STATUSES, type CodeReview, type CodeReviewFilter, type CodeReviewStatus } from '@shared/domain/codeReview';
import { useCommands, type Command } from '../../app/commands/commandStore';
import { invalidateWorkspace } from '../../app/queryClient';
import { useWorkspaceInfo, useWorkspacePath } from '../../app/workspace/useWorkspace';
import { EMPTY_SELECTION, type SelectionState } from '../../lib/selection';
import { UserLabel } from '../../ui/Avatar';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { IconButton } from '../../ui/IconButton';
import { RelativeTime } from '../../ui/RelativeTime';
import { SearchField } from '../../ui/SearchField';
import { ChoiceChip } from '../../ui/ChoiceChip';
import { CenteredSpinner } from '../../ui/Spinner';
import { DataTable, type Column } from '../../ui/table/DataTable';
import { ViewHeader } from '../../ui/ViewHeader';
import { codeReviewMenu } from './codeReviewMenu';
import { describeTarget, openReview } from './codeReviewOperations';
import { CodeReviewStatusBadge } from './CodeReviewStatusBadge';
import { openCreateCodeReviewDialog } from './CreateCodeReviewDialog';
import { useCodeReviews } from './useCodeReviews';
import styles from './CodeReviewsView.module.css';

type StatusFilter = CodeReviewStatus | 'any';

const COLUMNS: Column<CodeReview>[] = [
  {
    id: 'title',
    header: 'Title',
    grow: 3,
    render: (review) => (
      <span className={styles.title}>
        <span className={styles.id}>#{review.id}</span>
        {review.title}
      </span>
    ),
    sortValue: (review) => review.title.toLowerCase(),
  },
  { id: 'status', header: 'Status', width: 150, render: (review) => <CodeReviewStatusBadge status={review.status} />, sortValue: (review) => review.status },
  { id: 'target', header: 'Changes', grow: 1, secondary: true, render: (review) => describeTarget(review.target) },
  { id: 'owner', header: 'Author', grow: 1, render: (review) => <UserLabel user={review.owner} />, sortValue: (review) => review.owner },
  {
    id: 'assignee',
    header: 'Reviewer',
    grow: 1,
    render: (review) => (review.assignee ? <UserLabel user={review.assignee} /> : <span className={styles.unassigned}>Unassigned</span>),
    sortValue: (review) => review.assignee,
  },
  { id: 'date', header: 'Created', width: 120, secondary: true, render: (review) => <RelativeTime date={review.date} />, sortValue: (review) => review.date },
];

export function CodeReviewsView() {
  const workspacePath = useWorkspacePath();
  const { data: workspace } = useWorkspaceInfo();
  const [scope, setScope] = useState<CodeReviewFilter['scope']>('all');
  const [status, setStatus] = useState<StatusFilter>('any');
  const [search, setSearch] = useState('');
  const [selection, setSelection] = useState<SelectionState>(EMPTY_SELECTION);
  const { data: reviews, isLoading, isFetching, error } = useCodeReviews({ scope, status: status === 'any' ? undefined : status });

  const visible = (reviews ?? []).filter((review) => `${review.title} ${review.id}`.toLowerCase().includes(search.toLowerCase()));
  const currentBranch = workspace?.selector.kind === 'branch' ? workspace.selector.name : '';
  const commands = useMemo<Command[]>(
    () => [
      {
        id: 'codeReviews.new',
        group: 'Code reviews',
        label: 'New code review…',
        icon: MessageSquareCode,
        run: () => openCreateCodeReviewDialog(workspacePath, { kind: 'branch', value: currentBranch }),
      },
    ],
    [workspacePath, currentBranch],
  );
  useCommands(commands);
  const newReview = commands[0]!.run;

  const header = (
    <ViewHeader
      title="Code reviews"
      subtitle={reviews && `${reviews.length} ${reviews.length === 1 ? 'review' : 'reviews'}`}
      actions={
        <>
          <IconButton
            icon={<RefreshCw size={14} className={isFetching ? styles.spinning : undefined} />}
            label="Refresh"
            onClick={() => void invalidateWorkspace(workspacePath)}
          />
          <Button variant="primary" icon={<Plus size={14} />} onClick={newReview}>
            New review
          </Button>
        </>
      }
    >
      <SearchField value={search} onChange={setSearch} placeholder="Filter reviews" />
      <ChoiceChip<CodeReviewFilter['scope']>
        value={scope}
        onChange={setScope}
        icon={<Users size={13} />}
        neutralValue="all"
        choices={[
          { value: 'all', label: 'Everyone' },
          { value: 'createdByMe', label: 'Created by me' },
          { value: 'assignedToMe', label: 'Assigned to me' },
        ]}
      />
      <ChoiceChip<StatusFilter>
        value={status}
        onChange={setStatus}
        icon={<CircleDot size={13} />}
        neutralValue="any"
        choices={[{ value: 'any', label: 'Any status' }, ...CODE_REVIEW_STATUSES.map((value) => ({ value, label: value }))]}
      />
    </ViewHeader>
  );

  if (isLoading) return <>{header}<CenteredSpinner /></>;
  if (error) return <>{header}<EmptyState title="Couldn't read the code reviews" description={error.message} /></>;
  if (visible.length === 0) {
    return (
      <>
        {header}
        <EmptyState
          icon={<MessageSquareCode size={22} />}
          title="No code reviews"
          description="Ask a teammate to look at a branch or changeset before it gets merged."
          action={
            <Button variant="primary" icon={<Plus size={14} />} onClick={newReview}>
              New review
            </Button>
          }
        />
      </>
    );
  }

  return (
    <>
      {header}
      <DataTable
        rows={visible}
        columns={COLUMNS}
        rowKey={(review) => String(review.id)}
        selection={selection}
        onSelectionChange={setSelection}
        onActivate={openReview}
        contextMenu={(rows) => codeReviewMenu(workspacePath, rows)}
        initialSort={{ columnId: 'date', descending: true }}
      />
    </>
  );
}
