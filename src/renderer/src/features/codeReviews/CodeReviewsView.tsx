import { CircleDot, MessageSquareCode, Plus, UserCheck } from 'lucide-react';
import { useCallback, useMemo } from 'react';
import { CODE_REVIEW_STATUSES, MAX_LISTED_CODE_REVIEWS, type CodeReview } from '@shared/domain/codeReview';
import { useCommands, type Command } from '../../app/commands/commandStore';
import { DetailsToggleButton } from '../../components/DetailsToggleButton';
import { ViewRefreshButton } from '../../components/ViewRefreshButton';
import { usePlace, useWorkspaceInfo } from '../../app/workspace/useWorkspace';
import { useViewSelection } from '../../app/navigation/viewSelectionStore';
import { ObjectListView } from '../../components/ObjectListView';
import { branchWorkedOn } from '../../components/workingObject';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { ChoiceChip } from '../../ui/ChoiceChip';
import { ViewHeader } from '../../ui/ViewHeader';
import { CODE_REVIEW_COLUMNS } from './codeReviewColumns';
import { CodeReviewDetails } from './CodeReviewDetails';
import { codeReviewMenu } from './codeReviewMenu';
import { codeReviewPage, openReview } from './codeReviewOperations';
import { openCreateCodeReviewDialog } from './CreateCodeReviewDialog';
import { useSelectCreated } from './useSelectCreated';
import { useCodeReviews } from './useCodeReviews';
import { SincePicker } from '../../components/SincePicker';
import { usePlaceUser } from '../../app/account/accounts';
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
import { codeReviewCopyTexts } from './codeReviewMenu';
import { useCopyCommand } from '../../app/commands/useCopyCommand';
import { useShowInFollowingWindow } from '../../app/pageWindow/useShowInFollowingWindow';
import { matchesWordFilter } from '../../lib/matchesAllWords';
import { codeReviewsQuery, reviewFilterTexts } from './codeReviewFilters';

const ownerOf = (review: CodeReview): string => review.owner;

export function CodeReviewsView() {
  const place = usePlace();
  const { data: workspace } = useWorkspaceInfo();
  const filters = useCodeReviewsViewStore();
  const { text: search, people, since, status, assignedToMe, update } = filters;
  const me = usePlaceUser();
  const queriedPeople = useDebouncedValue(people, PICKING_PAUSE_MS);
  const [selection, setSelection] = useViewSelection('codeReviews');
  const { data: reviews, isPending, isFetching, error } = useCodeReviews(codeReviewsQuery({ since, people: queriedPeople, status, assignedToMe }));
  const offered = usePeopleSeen('codeReviews', reviews, ownerOf);

  // The same rows while only the selection changes: the table sorts them again only when they change.
  const visible = useMemo(
    () => (reviews ?? []).filter((review) => matchesPeople(people, me, review.owner) && matchesWordFilter(reviewFilterTexts(review), search)),
    [reviews, people, me, search],
  );
  const visibleKeys = useMemo(() => visible.map(reviewKey), [visible]);
  const selectWhenShown = useSelectCreated(visibleKeys, setSelection);
  const currentBranch = branchWorkedOn(workspace?.selector) ?? '';
  // On the workspace's branch, and selected once the refreshed list shows it.
  const newReview = useCallback(
    () => openCreateCodeReviewDialog(place, { kind: 'branch', value: currentBranch }, (reviewId) => selectWhenShown(String(reviewId))),
    [place, currentBranch, selectWhenShown],
  );
  useCommands(
    useMemo<Command[]>(() => [{ id: 'codeReviews.new', group: 'Code reviews', label: 'New code review…', icon: MessageSquareCode, run: newReview }], [newReview]),
  );
  const selected = visible.find((review) => reviewKey(review) === selection.anchor);
  useShowInFollowingWindow(selected ? codeReviewPage(selected) : null);
  useCopyCommand('Code reviews', 'Code review', selection.selected.size === 1 && selected ? codeReviewCopyTexts(place, selected) : undefined);

  const header = (
    <ViewHeader
      title="Code reviews"
      detailsToggle={<DetailsToggleButton detailsKey="codeReviews" />}
      count={reviews && visible.length}
      total={reviews?.length}
      subtitle={reviews && reviews.length >= MAX_LISTED_CODE_REVIEWS && 'newest'}
      actions={
        <>
          <ViewRefreshButton fetching={isFetching} />
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
        detailsKey="codeReviews"
        loading={isPending}
        error={error}
        errorTitle="Couldn't read the code reviews"
        filtering={isFiltering(filters, CLEARED_CODE_REVIEW_FILTERS)}
        noMatches={<NoMatches icon={<MessageSquareCode size={22} />} noun="code reviews" hint={longerRangeHint(since, true)} onClear={filters.clear} />}
        emptyState={
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
        }
        query={search}
        rows={visible}
        columns={CODE_REVIEW_COLUMNS}
        rowKey={reviewKey}
        selection={selection}
        onSelectionChange={setSelection}
        onActivate={(review) => openReview(review)}
        contextMenu={(rows) => codeReviewMenu(place, rows, workspace?.selector)}
        initialSort={{ columnId: 'date', descending: true }}
        noun="code review"
        details={selected && <CodeReviewDetails key={selected.id} review={selected} menu={codeReviewMenu(place, [selected], workspace?.selector)} />}
      />
    </>
  );
}

function reviewKey(review: CodeReview): string {
  return String(review.id);
}
