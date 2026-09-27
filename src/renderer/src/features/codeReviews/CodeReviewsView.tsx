import { CircleDot, MessageSquareCode, Plus, RefreshCw, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { CODE_REVIEW_STATUSES, MAX_LISTED_CODE_REVIEWS, type CodeReview, type CodeReviewFilter, type CodeReviewStatus } from '@shared/domain/codeReview';
import { useCommands, type Command } from '../../app/commands/commandStore';
import { invalidateWorkspace } from '../../app/queryClient';
import { useWorkspaceInfo, useWorkspacePath } from '../../app/workspace/useWorkspace';
import { useViewSelection } from '../../app/navigation/viewSelectionStore';
import { ListWithDetails } from '../../components/ListWithDetails';
import { ListWithDetailsSkeleton } from '../../components/ListWithDetailsSkeleton';
import { NoSelection } from '../../components/NoSelection';
import { PathLabel } from '../../components/PathLabel';
import { UserLabel } from '../../ui/Avatar';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { Highlight, HighlightQuery } from '../../ui/Highlight';
import { IconButton } from '../../ui/IconButton';
import { RelativeTime } from '../../ui/RelativeTime';
import { SearchField } from '../../ui/SearchField';
import { ChoiceChip } from '../../ui/ChoiceChip';
import { DataTable, type Column } from '../../ui/table/DataTable';
import { ViewHeader } from '../../ui/ViewHeader';
import { CodeReviewDetails } from './CodeReviewDetails';
import { codeReviewMenu } from './codeReviewMenu';
import { openReview } from './codeReviewOperations';
import { describeTarget } from './reviewTarget';
import { CodeReviewStatusBadge } from './CodeReviewStatusBadge';
import { openCreateCodeReviewDialog } from './CreateCodeReviewDialog';
import { codeReviewsEmptyState } from './codeReviewsEmptyState';
import { selectCreated } from './selectCreated';
import { useCodeReviews } from './useCodeReviews';
import { SincePicker } from '../../components/SincePicker';
import { sinceDateFor, type SincePreset } from '../../lib/sincePresets';
import styles from './CodeReviewsView.module.css';
import { codeReviewCopyTexts } from './codeReviewMenu';
import { useCopyCommand } from '../../app/commands/useCopyCommand';

type StatusFilter = CodeReviewStatus | 'any';

const DEFAULT_SINCE: SincePreset = 'last3Months';

const COLUMNS: Column<CodeReview>[] = [
  {
    id: 'title',
    header: 'Title',
    grow: 3,
    render: (review) => (
      <span className={styles.title}>
        <span className={styles.id}>
          #<Highlight text={String(review.id)} />
        </span>
        <span className={styles.titleText}>
          <Highlight text={review.title} />
        </span>
      </span>
    ),
    sortValue: (review) => review.title.toLowerCase(),
  },
  { id: 'status', header: 'Status', width: 150, render: (review) => <CodeReviewStatusBadge status={review.status} />, sortValue: (review) => review.status },
  {
    id: 'target',
    header: 'Changes',
    grow: 1,
    secondary: true,
    hideBelow: 820,
    render: (review) => (review.target.kind === 'branch' ? <PathLabel path={review.target.branch} /> : describeTarget(review.target)),
  },
  { id: 'owner', header: 'Author', grow: 1, hideBelow: 600, render: (review) => <UserLabel user={review.owner} />, sortValue: (review) => review.owner },
  {
    id: 'assignee',
    header: 'Reviewer',
    grow: 1,
    hideBelow: 700,
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
  const [since, setSince] = useState<SincePreset>(DEFAULT_SINCE);
  const [selection, setSelection] = useViewSelection('codeReviews');
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const { data: reviews, isLoading, isFetching, error } = useCodeReviews({
    scope,
    status: status === 'any' ? undefined : status,
    sinceDate: sinceDateFor(since),
  });

  const visible = (reviews ?? []).filter((review) => `${review.title} ${review.id}`.toLowerCase().includes(search.trim().toLowerCase()));
  const currentBranch = workspace?.selector.kind === 'branch' ? workspace.selector.name : '';
  const commands = useMemo<Command[]>(
    () => [
      {
        id: 'codeReviews.new',
        group: 'Code reviews',
        label: 'New code review…',
        icon: MessageSquareCode,
        run: () => openCreateCodeReviewDialog(workspacePath, { kind: 'branch', value: currentBranch }, (reviewId) => setCreatedKey(String(reviewId))),
      },
    ],
    [workspacePath, currentBranch],
  );
  // The review just created is selected once the refreshed list shows it.
  const shownKeys = visible.map(reviewKey).join('\n');
  useEffect(() => {
    const next = selectCreated(shownKeys.split('\n'), createdKey);
    if (!next) return;
    setSelection(next);
    setCreatedKey(null);
  }, [shownKeys, createdKey, setSelection]);
  useCommands(commands);
  const selected = visible.find((review) => reviewKey(review) === selection.anchor);
  useCopyCommand('Code reviews', 'Code review', selection.selected.size === 1 && selected ? codeReviewCopyTexts(selected) : undefined);
  const newReview = commands[0]!.run;

  const header = (
    <ViewHeader
      title="Code reviews"
      count={reviews?.length}
      subtitle={reviews && reviews.length >= MAX_LISTED_CODE_REVIEWS && 'newest'}
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
      <SincePicker value={since} onChange={setSince} />
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

  if (isLoading) return <>{header}<ListWithDetailsSkeleton widthKey="codeReviews" columns={COLUMNS} /></>;
  if (error) return <>{header}<EmptyState title="Couldn't read the code reviews" description={error.message} /></>;
  if (visible.length === 0) {
    const empty = codeReviewsEmptyState({ searching: search.trim() !== '', filtered: scope !== 'all' || status !== 'any' || since !== DEFAULT_SINCE });
    const clearFilters = (): void => {
      setSearch('');
      setScope('all');
      setStatus('any');
      setSince(DEFAULT_SINCE);
    };
    return (
      <>
        {header}
        <EmptyState
          icon={<MessageSquareCode size={22} />}
          title={empty.title}
          description={empty.description}
          action={
            empty.action === 'newReview' ? (
              <Button variant="primary" icon={<Plus size={14} />} onClick={newReview}>
                New review
              </Button>
            ) : (
              <Button onClick={clearFilters}>Clear filters</Button>
            )
          }
        />
      </>
    );
  }


  return (
    <>
      {header}
      <ListWithDetails widthKey="codeReviews"
        list={
          <HighlightQuery query={search}>
            <DataTable
              rows={visible}
              columns={COLUMNS}
              rowKey={reviewKey}
              selection={selection}
              onSelectionChange={setSelection}
              selectFirstRow
              onActivate={(review) => openReview(review)}
              contextMenu={(rows) => codeReviewMenu(workspacePath, rows)}
              initialSort={{ columnId: 'date', descending: true }}
            />
          </HighlightQuery>
        }
        details={
          selected ? <CodeReviewDetails key={selected.id} review={selected} menu={codeReviewMenu(workspacePath, [selected])} /> : <NoSelection noun="code review" />
        }
      />
    </>
  );
}

function reviewKey(review: CodeReview): string {
  return String(review.id);
}
