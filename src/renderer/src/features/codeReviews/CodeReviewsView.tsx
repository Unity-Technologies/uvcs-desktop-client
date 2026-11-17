import { CircleDot, GitPullRequest, GitPullRequestArrow, Inbox, Layers, MessageSquarePlus, UserCheck } from 'lucide-react';
import { useCallback, useMemo } from 'react';
import { CODE_REVIEW_STATUSES, type CodeReview } from '@shared/domain/codeReview';
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
import { codeReviewColumns } from './codeReviewColumns';
import { CodeReviewDetails } from './CodeReviewDetails';
import { codeReviewMenu } from './codeReviewMenu';
import { codeReviewPage, openReview } from './codeReviewOperations';
import { openCreateCodeReviewDialog } from './CreateCodeReviewDialog';
import { newMergeRequestCommand } from './useMergeRequestCommands';
import { GitPullRequestPlus } from '../../components/GitPullRequestPlus';
import { SplitButton } from '../../ui/SplitButton';
import { useSelectCreated } from './useSelectCreated';
import { useCodeReviewsListFilter } from './useCodeReviewsListFilter';
import { useCodeReviews } from './useCodeReviews';
import { SincePicker } from '../../components/SincePicker';
import { usePlaceUser } from '../../app/account/accounts';
import { PeopleFilter } from '../../components/people/PeopleFilter';
import { usePeopleSeen } from '../../components/people/usePeopleSeen';
import { matchesPeople } from '../../lib/peopleFilter';
import { longerRangeHint } from '../../lib/longerRangeHint';
import { isFiltering } from '../../lib/viewFilters';
import { FilterBar } from '../../ui/FilterBar';
import { FilterField } from '../../ui/FilterField';
import { NoMatches } from '../../ui/NoMatches';
import { CLEARED_CODE_REVIEW_FILTERS, type MergeRequestStateFilter, type ReviewKindFilter, useCodeReviewsViewStore, type StatusFilter } from './codeReviewsViewStore';
import { codeReviewCopyTexts } from './codeReviewMenu';
import { reviewNoun } from './mergeRequestState';
import { useCopyCommand } from '../../app/commands/useCopyCommand';
import { useShowInFollowingWindow } from '../../app/pageWindow/useShowInFollowingWindow';
import { matchesWordFilter } from '../../lib/matchesAllWords';
import { waitingCount } from './waitingForMe';
import { isNarrowed, matchesKind, matchesOpenedByMe, matchesReviewers, matchesState, matchesWaiting, showsStateChip, stateUnderKind, openedByMeCount, openedChipLabel, reviewFilterTexts, waitingChipLabel } from './codeReviewFilters';
import { ToggleChip } from '../../ui/ToggleChip';

const ownerOf = (review: CodeReview): string => review.owner;
const itself = (name: string): string => name;

/** The State chip's choices: Active (the code reviews and merge requests still to merge) is where it rests. */
const STATE_CHOICES: { value: MergeRequestStateFilter; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'merged', label: 'Merged' },
  { value: 'closed', label: 'Closed' },
  { value: 'all', label: 'All' },
];

/** The Kind chip's choices: both kinds together is where it rests. */
const KIND_CHOICES: { value: ReviewKindFilter; label: string }[] = [
  { value: 'any', label: 'Any kind' },
  { value: 'mergeRequests', label: 'Merge requests' },
  { value: 'codeReviews', label: 'Code reviews' },
];

export function CodeReviewsView() {
  const place = usePlace();
  const { data: workspace } = useWorkspaceInfo();
  const filters = useCodeReviewsViewStore();
  const { text: search, people, since, status, kind, reviewers, waitingForMe, openedByMe, update } = filters;
  // Code reviews alone have no state: the State chip hides and its state is left out (`stateUnderKind`).
  const mergeRequestState = stateUnderKind(kind, filters.mergeRequestState);
  const me = usePlaceUser();
  const [selection, setSelection] = useViewSelection('codeReviews');
  const { data: reviews, isPending, isFetching, error } = useCodeReviews(useCodeReviewsListFilter());
  const offered = usePeopleSeen('codeReviews', reviews, ownerOf);
  const reviewerNames = useMemo(() => (reviews ?? []).flatMap((review) => review.reviewers.map((reviewer) => reviewer.name)), [reviews]);
  const offeredReviewers = usePeopleSeen('codeReviewReviewers', reviewerNames, itself);

  // The same rows while only the selection changes: the table sorts them again only when they change.
  const visible = useMemo(
    () =>
      (reviews ?? []).filter(
        (review) =>
          matchesPeople(people, me, review.owner) &&
          matchesKind(review, kind) &&
          matchesState(review, mergeRequestState) &&
          matchesReviewers(review, reviewers, me) &&
          matchesWaiting(review, waitingForMe, me) &&
          matchesOpenedByMe(review, openedByMe, me) &&
          matchesWordFilter(reviewFilterTexts(review), search),
      ),
    [reviews, people, me, kind, mergeRequestState, reviewers, waitingForMe, openedByMe, search],
  );
  // The reviews read that wait for the user: Waiting for me counts them.
  const waiting = useMemo(() => waitingCount(reviews ?? [], me), [reviews, me]);
  const opened = useMemo(() => openedByMeCount(reviews ?? [], me), [reviews, me]);
  // The same columns while the user stays the same: the table sorts its rows again only when they change.
  const columns = useMemo(() => codeReviewColumns(me), [me]);
  const visibleKeys = useMemo(() => visible.map(reviewKey), [visible]);
  const selectWhenShown = useSelectCreated(visibleKeys, setSelection);
  const currentBranch = branchWorkedOn(workspace?.selector);
  // What the view creates starts on the workspace's branch, and is selected once the refreshed list shows it. Its New
  // merge request… replaces the window's (`useMergeRequestCommands`) while the view shows, for that.
  const selectCreated = useCallback((reviewId: number) => selectWhenShown(String(reviewId)), [selectWhenShown]);
  const mergeRequestCommand = useMemo(() => newMergeRequestCommand(place, currentBranch, selectCreated), [place, currentBranch, selectCreated]);
  const newReview = useCallback(() => openCreateCodeReviewDialog(place, { kind: 'branch', value: currentBranch ?? '' }, selectCreated), [place, currentBranch, selectCreated]);
  useCommands(
    useMemo<Command[]>(
      () => [mergeRequestCommand, { id: 'codeReviews.new', group: 'Merge requests', label: 'New code review…', icon: MessageSquarePlus, run: newReview }],
      [mergeRequestCommand, newReview],
    ),
  );
  const selected = visible.find((review) => reviewKey(review) === selection.anchor);
  useShowInFollowingWindow(selected ? codeReviewPage(selected) : null);
  useCopyCommand('Merge requests', selected ? reviewNoun(selected) : 'Code review', selection.selected.size === 1 && selected ? codeReviewCopyTexts(place, selected) : undefined);

  const header = (
    <ViewHeader
      title="Merge requests"
      detailsToggle={<DetailsToggleButton detailsKey="codeReviews" />}
      count={reviews && visible.length}
      total={reviews?.length}
      actions={
        <>
          <ViewRefreshButton fetching={isFetching} />
          <SplitButton
            variant="primary"
            icon={<GitPullRequestPlus size={14} />}
            onClick={mergeRequestCommand.run}
            menuLabel="More to create"
            menu={[{ id: 'newCodeReview', label: 'New code review…', icon: MessageSquarePlus, run: newReview }]}
          >
            New merge request
          </SplitButton>
        </>
      }
    >
      <FilterBar
        text={<FilterField value={search} onChange={(text) => update({ text })} placeholder="Filter merge requests" />}
        people={<PeopleFilter value={people} onChange={(value) => update({ people: value })} people={offered} mineTip="Reviews you created" />}
        time={<SincePicker value={since} onChange={(value) => update({ since: value })} />}
        kinds={
          <>
            <ToggleChip pressed={waitingForMe} icon={<Inbox size={13} />} onChange={(value) => update({ waitingForMe: value })}>
              {waitingChipLabel(waiting)}
            </ToggleChip>
            <ToggleChip pressed={openedByMe} icon={<GitPullRequestArrow size={13} />} onChange={(value) => update({ openedByMe: value })}>
              {openedChipLabel(opened)}
            </ToggleChip>
            <PeopleFilter
              value={reviewers}
              onChange={(value) => update({ reviewers: value })}
              people={offeredReviewers}
              mineTip="Reviews you're asked to review"
              mine={{ label: "I'm a reviewer", icon: <UserCheck size={13} /> }}
              pickLabel="Pick reviewers"
            />
            <ChoiceChip<ReviewKindFilter>
              value={kind}
              onChange={(value) => update({ kind: value })}
              icon={<Layers size={13} />}
              neutralValue="any"
              choices={KIND_CHOICES}
            />
            {showsStateChip(kind) && (
              <ChoiceChip<MergeRequestStateFilter>
                value={filters.mergeRequestState}
                onChange={(value) => update({ mergeRequestState: value })}
                icon={<GitPullRequest size={13} />}
                neutralValue="active"
                choices={STATE_CHOICES}
              />
            )}
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
        errorTitle="Couldn't read the merge requests"
        filtering={isNarrowed(isFiltering(filters, CLEARED_CODE_REVIEW_FILTERS), reviews?.length ?? 0, visible.length)}
        noMatches={<NoMatches icon={<GitPullRequest size={22} />} noun="merge requests" hint={longerRangeHint(since, true)} onClear={filters.clear} />}
        emptyState={
          <EmptyState
            icon={<GitPullRequest size={22} />}
            title="No merge requests"
            description={since === 'anyTime' ? 'Ask to merge a branch once a teammate has reviewed it.' : 'None in this time range. Try a longer one, or ask to merge a branch.'}
            action={
              <Button variant="primary" icon={<GitPullRequestPlus size={14} />} onClick={mergeRequestCommand.run}>
                New merge request
              </Button>
            }
          />
        }
        query={search}
        rows={visible}
        columns={columns}
        rowKey={reviewKey}
        selection={selection}
        onSelectionChange={setSelection}
        onActivate={(review) => openReview(review)}
        contextMenu={(rows) => codeReviewMenu(place, rows, workspace?.selector)}
        noun="merge request"
        details={selected && <CodeReviewDetails key={selected.id} review={selected} menu={codeReviewMenu(place, [selected], workspace?.selector)} />}
      />
    </>
  );
}

function reviewKey(review: CodeReview): string {
  return String(review.id);
}
