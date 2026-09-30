import { CircleDot, MessageSquareCode, Plus, UserCheck } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { CODE_REVIEW_STATUSES, MAX_LISTED_CODE_REVIEWS, type CodeReview } from '@shared/domain/codeReview';
import { useCommands, type Command } from '../../app/commands/commandStore';
import { ViewRefreshButton } from '../../components/ViewRefreshButton';
import { useWorkspaceInfo, useWorkspacePath } from '../../app/workspace/useWorkspace';
import { useViewSelection } from '../../app/navigation/viewSelectionStore';
import { ObjectListView } from '../../components/ObjectListView';
import { PathLabel } from '../../components/PathLabel';
import { UserLabel } from '../../ui/Avatar';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { Highlight } from '../../ui/Highlight';
import { RelativeTime } from '../../ui/RelativeTime';
import { ChoiceChip } from '../../ui/ChoiceChip';
import type { Column } from '../../ui/table/DataTable';
import { ViewHeader } from '../../ui/ViewHeader';
import { CodeReviewDetails } from './CodeReviewDetails';
import { codeReviewMenu } from './codeReviewMenu';
import { openReview } from './codeReviewOperations';
import { describeTarget } from './reviewTarget';
import { CodeReviewStatusBadge } from './CodeReviewStatusBadge';
import { openCreateCodeReviewDialog } from './CreateCodeReviewDialog';
import { selectCreated } from './selectCreated';
import { useCodeReviews } from './useCodeReviews';
import { SincePicker } from '../../components/SincePicker';
import { useWorkspaceUser } from '../../app/account/accounts';
import { PeopleFilter } from '../../components/people/PeopleFilter';
import { usePeopleSeen } from '../../components/people/usePeopleSeen';
import { matchesPeople, PICKING_PAUSE_MS } from '../../lib/peopleFilter';
import { useDebouncedValue } from '../../lib/useDebouncedValue';
import { longerRangeHint } from '../../lib/longerRangeHint';
import { isFiltering } from '../../lib/viewFilters';
import { FilterBar } from '../../ui/FilterBar';
import { FilterField } from '../../ui/FilterField';
import { NoMatches } from '../../ui/NoMatches';
import { ToggleChip } from '../../ui/ToggleChip';
import { CLEARED_CODE_REVIEW_FILTERS, useCodeReviewsViewStore, type StatusFilter } from './codeReviewsViewStore';
import styles from './CodeReviewsView.module.css';
import { codeReviewCopyTexts } from './codeReviewMenu';
import { useCopyCommand } from '../../app/commands/useCopyCommand';
import { matchesWordFilter } from '../../lib/matchesAllWords';
import { codeReviewsQuery, reviewFilterTexts } from './codeReviewFilters';

const ownerOf = (review: CodeReview): string => review.owner;

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
    render: (review) => (review.target.kind === 'branch' ? <PathLabel path={review.target.branch} /> : <Highlight text={describeTarget(review.target)} />),
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
  const filters = useCodeReviewsViewStore();
  const { text: search, people, since, status, assignedToMe, update } = filters;
  const me = useWorkspaceUser();
  const queriedPeople = useDebouncedValue(people, PICKING_PAUSE_MS);
  const [selection, setSelection] = useViewSelection('codeReviews');
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const { data: reviews, isLoading, isFetching, error } = useCodeReviews(codeReviewsQuery({ since, people: queriedPeople, status, assignedToMe }));
  const offered = usePeopleSeen('codeReviews', reviews, ownerOf);

  const visible = (reviews ?? []).filter((review) => matchesPeople(people, me, review.owner) && matchesWordFilter(reviewFilterTexts(review), search));
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
      count={reviews && visible.length}
      total={reviews?.length}
      subtitle={reviews && reviews.length >= MAX_LISTED_CODE_REVIEWS && 'newest'}
      actions={
        <>
          <ViewRefreshButton workspacePath={workspacePath} fetching={isFetching} />
          <Button variant="primary" icon={<Plus size={14} />} onClick={newReview}>
            New review
          </Button>
        </>
      }
    >
      <FilterBar
        text={<FilterField value={search} onChange={(text) => update({ text })} placeholder="Filter code reviews" />}
        people={<PeopleFilter value={people} onChange={(value) => update({ people: value })} people={offered} mineTip="Reviews you created" />}
        time={<SincePicker value={since} onChange={(value) => update({ since: value })} />}
        kinds={
          <>
            <ToggleChip pressed={assignedToMe} icon={<UserCheck size={13} />} onChange={(value) => update({ assignedToMe: value })}>
              Assigned to me
            </ToggleChip>
            <ChoiceChip<StatusFilter>
              value={status}
              onChange={(value) => update({ status: value })}
              icon={<CircleDot size={13} />}
              neutralValue="any"
              choices={[{ value: 'any', label: 'Any status' }, ...CODE_REVIEW_STATUSES.map((value) => ({ value, label: value }))]}
            />
          </>
        }
      />
    </ViewHeader>
  );

  return (
    <>
      {header}
      <ObjectListView
        widthKey="codeReviews"
        loading={isLoading}
        error={error}
        errorTitle="Couldn't read the code reviews"
        empty={
          isFiltering(filters, CLEARED_CODE_REVIEW_FILTERS) ? (
            <NoMatches icon={<MessageSquareCode size={22} />} noun="code reviews" hint={longerRangeHint(since, true)} onClear={filters.clear} />
          ) : (
            <EmptyState
              icon={<MessageSquareCode size={22} />}
              title="No code reviews"
              description={since === 'anyTime' ? 'Ask a teammate to look at a branch or changeset before it gets merged.' : 'None in this time range. Try a longer one, or ask a teammate for a review.'}
              action={
                <Button variant="primary" icon={<Plus size={14} />} onClick={newReview}>
                  New review
                </Button>
              }
            />
          )
        }
        query={search}
        rows={visible}
        columns={COLUMNS}
        rowKey={reviewKey}
        selection={selection}
        onSelectionChange={setSelection}
        onActivate={(review) => openReview(review)}
        contextMenu={(rows) => codeReviewMenu(workspacePath, rows)}
        initialSort={{ columnId: 'date', descending: true }}
        noun="code review"
        details={selected && <CodeReviewDetails key={selected.id} review={selected} menu={codeReviewMenu(workspacePath, [selected])} />}
      />
    </>
  );
}

function reviewKey(review: CodeReview): string {
  return String(review.id);
}
