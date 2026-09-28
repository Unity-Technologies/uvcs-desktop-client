import { CheckCircle2, Files, Folder, GitMerge, List, ListTree, SlidersHorizontal } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Changelist, PendingChange } from '@shared/domain/pendingChanges';
import { useChangeFilter } from '../../components/useChangeFilter';
import { openSettingsDialogAt } from '../../app/settings/SettingsDialog';
import { useSettings } from '../../app/settings/useSettings';
import { useWorkspaceInfo, useWorkspacePath } from '../../app/workspace/useWorkspace';
import { selectAfterLeaving, settleBeforeLeaving } from '../../app/navigation/leaveGuard';
import { useViewSelection } from '../../app/navigation/viewSelectionStore';
import { joinComment } from '../../lib/comment';
import { EMPTY_SELECTION } from '../../lib/selection';
import { useSettledValue } from '../../lib/useSettled';
import { formatCount, pluralize } from '../../lib/text';
import { EmptyState } from '../../ui/EmptyState';
import { HighlightQuery } from '../../ui/Highlight';
import { IconButton } from '../../ui/IconButton';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { ListSkeleton } from '../../ui/Skeleton';
import { SplitPane } from '../../ui/SplitPane';
import { ViewHeader } from '../../ui/ViewHeader';
import { useChangeset } from '../changesets/useChangeset';
import { LeftChangesBanner } from '../leftChanges/LeftChangesBanner';
import { MergeTaskSuggestion } from '../mergeTask/MergeTaskSuggestion';
import { MyShelvesButton } from '../shelves/MyShelvesButton';
import { ChangeDiffPanel } from './ChangeDiffPanel';
import { ChangesList } from './ChangesList';
import { ChangesSummaryBar } from './ChangesSummaryBar';
import { CheckinAfterUpdateNotice } from './CheckinAfterUpdateNotice';
import { CheckinPanel } from './CheckinPanel';
import { HiddenCheckedNotice, NoFilterMatches } from './FilterNotices';
import { LockedByOthersNotice } from './locks/LockedByOthersNotice';
import { RefreshButton } from './RefreshButton';
import { usePendingLocks } from './locks/usePendingLocks';
import { useIncomingSummary } from '../incoming/useIncomingSummary';
import { ReviewModeButton } from '../review/ReviewModeButton';
import { reviewProgress } from '../review/reviewStatus';
import { usePendingReview } from './review/usePendingReview';
import { BulkPrivateNotice, confirmBulkPrivateCheckin } from './BulkPrivateNotice';
import { behindBranch, behindDescription } from './checkinBehind';
import { mergeSourceChangeset } from './checkinButton';
import { checkinAfterUpdateMessage, useCheckinAfterUpdateStore } from './checkinAfterUpdate';
import { checkinChanges, confirmCheckinWithoutComment, shelveChanges, undoUnchangedCheckouts } from './checkinOperations';
import { isCheckinCandidate, matchesBranch } from './changeCategories';
import { changeKey, changesUnderRow, collapseRows, layoutChangeRows, topLevelCheckboxInset, type ChangeRow, type ChangesGrouping, type ChangesLayout } from './changeRows';
import { changelistMenu } from './changelistMenu';
import { moveToChangelist } from './changelistOperations';
import { changeTone } from './changeTone';
import { checkinDraftOf, useCheckinDraftStore, useExcludedPaths } from './checkinDraftStore';
import { pendingChangeMenu } from './pendingChangeMenu';
import { addFilterRule, openWithDefaultApp, undoChanges } from './pendingChangeOperations';
import { usePendingChangesViewStore } from './pendingChangesViewStore';
import { SuccessCard } from './SuccessCard';
import { isOutlivedByChanges, successCardTellsCheckin, successMomentLeft, useSuccessMomentStore } from './successMoment';
import { usePendingChanges } from './usePendingChanges';
import { useCheckinSelection } from './useCheckinSelection';
import { useSortedChanges } from './useSortedChanges';
import styles from './PendingChangesView.module.css';

const NO_CHANGES: PendingChange[] = [];
const NO_CHANGELISTS: Changelist[] = [];
const changePath = (change: PendingChange): string => change.path;

export function PendingChangesView() {
  const workspacePath = useWorkspacePath();
  const { data: workspace } = useWorkspaceInfo();
  const { data: snapshot, isLoading, isFetching, isPlaceholderData, dataUpdatedAt, error } = usePendingChanges();
  const { data: incomingSummary } = useIncomingSummary();
  const settings = useSettings();
  // Only what the view shows: dragging the description's height or typing the comment doesn't render the list again.
  const layout = usePendingChangesViewStore((state) => state.layout);
  const setLayout = usePendingChangesViewStore((state) => state.setLayout);
  const grouping = usePendingChangesViewStore((state) => state.grouping);
  const setGrouping = usePendingChangesViewStore((state) => state.setGrouping);
  const excludedPaths = useExcludedPaths(workspacePath);
  const setMessage = useCheckinDraftStore((state) => state.setMessage);
  const setIncluded = useCheckinDraftStore((state) => state.setIncluded);
  const clearMessage = useCheckinDraftStore((state) => state.clearMessage);

  const [selection, setSelection] = useViewSelection('changes');
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const summaryRef = useRef<HTMLInputElement>(null);

  const allChanges = snapshot?.changes ?? NO_CHANGES;
  const review = usePendingReview(workspacePath, allChanges, snapshot !== undefined && !isPlaceholderData);
  const locks = usePendingLocks(workspacePath, workspace?.repository, allChanges, dataUpdatedAt);
  // Sorted once for the layout; filtering keeps the order, so typing in the filter or opening a folder never sorts again.
  const sorted = useSortedChanges(allChanges, layout);
  const { visible: filtered, query, clear: clearTextFilter, bar: filterBar } = useChangeFilter(sorted, changePath, changeTone);
  const changes = useMemo(() => review.narrow(filtered), [review.narrow, filtered]);
  const clearFilter = (): void => {
    clearTextFilter();
    review.showAll();
  };
  const { isIncluded, included, upload, shelvable, shelvableUpload, bulkPrivate } = useCheckinSelection(allChanges, excludedPaths);
  // The changes shown are some of all of them: the checked ones they leave out are the rest.
  const hiddenIncludedCount = useMemo(() => included.length - changes.filter(isIncluded).length, [changes, included, isIncluded]);
  const branchName = workspace?.selector.kind === 'branch' ? workspace.selector.name : undefined;
  const rejectedCheckin = useCheckinAfterUpdateStore((state) => state.rejected[workspacePath]);
  const forgetRejectedCheckin = useCheckinAfterUpdateStore((state) => state.forget);
  const checkinAfterUpdate = checkinAfterUpdateMessage(
    rejectedCheckin,
    { branch: branchName, loadedChangeset: workspace?.loadedChangeset },
    included.length,
  );
  const reviewed = useMemo(() => reviewProgress(included, review.statusOf), [included, review.statusOf]);
  const successMoment = useSuccessMomentStore((state) => state.moments[workspacePath]);
  const clearSuccessMoment = useSuccessMomentStore((state) => state.clear);
  // Arrowing renders the view on every step: what it asks of the selection is looked up, never searched for.
  const changesByKey = useMemo(() => new Map(changes.map((change) => [changeKey(change), change])), [changes]);
  const selectedCount = countSelected(selection.selected, changesByKey);
  const changelists = snapshot?.changelists ?? NO_CHANGELISTS;
  // Selecting a row or checking one renders the view again: thousands of changes are laid out again only when they or their layout change.
  const allRows = useMemo(() => layoutChangeRows({ changes, changelists, layout, grouping }), [changes, changelists, layout, grouping]);
  const rows = useMemo(() => collapseRows(allRows, collapsed), [allRows, collapsed]);
  const checkboxInset = useMemo(() => topLevelCheckboxInset(rows), [rows]);
  const focused = selection.anchor === null ? undefined : changesByKey.get(selection.anchor);
  // Holding ↓ moves through the list at once; the diff (a read and an editor to lay out) follows where it stops.
  const diffChange = useSettledValue(focused, selection.anchor ?? '') ?? focused;
  // A folder or changelist the keyboard (or a click) is on.
  const focusedFolder = focused ? undefined : rows.find((row) => row.type !== 'change' && row.key === selection.anchor);
  const { mergeChanges, pendingCount, onlyNeverCheckedIn } = useMemo(
    () => ({
      mergeChanges: allChanges.filter((change) => change.mergeInfo),
      pendingCount: allChanges.filter(isCheckinCandidate).length,
      onlyNeverCheckedIn: matchesBranch(allChanges),
    }),
    [allChanges],
  );
  const { data: mergeSource } = useChangeset(mergeSourceChangeset(mergeChanges));
  const firstChangeKey = rows.find((row) => row.type === 'change')?.key;
  // Checking in completes a pending merge as it is; updating first is for plain check-ins.
  const behind = mergeChanges.length > 0 ? null : behindBranch(incomingSummary, branchName);

  // The next change ends the success moment, even before its time is up.
  useEffect(() => {
    if (successMoment && isOutlivedByChanges(successMoment, dataUpdatedAt, allChanges.length)) clearSuccessMoment(workspacePath);
  }, [successMoment, dataUpdatedAt, allChanges.length]);

  // Keep something selected, so the diff pane is useful from the start and after the selected file goes away.
  useEffect(() => {
    if (!focused && !focusedFolder && firstChangeKey) setSelection({ selected: new Set([firstChangeKey]), anchor: firstChangeKey });
  }, [focused, focusedFolder, firstChangeKey]);

  const setIncludedChanges = (selected: PendingChange[], include: boolean): void =>
    setIncluded(workspacePath, selected.map((change) => change.path), include);
  const toggleIncluded = (rows: ChangeRow[], include: boolean): void => setIncludedChanges(rows.flatMap(changesUnderRow), include);

  // Checking in completes a pending merge: start its comment with where the merge comes from.
  useEffect(() => {
    const draft = checkinDraftOf(workspacePath);
    if (mergeSource && !draft.summary && !draft.description) setMessage(workspacePath, { summary: `Merged from ${mergeSource.branch}` });
  }, [mergeSource?.id]);

  const toggleCollapsed = (key: string): void =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const runBusy = async (operation: () => Promise<boolean>): Promise<boolean> => {
    setBusy(true);
    try {
      return await operation();
    } finally {
      setBusy(false);
    }
  };

  const checkin = async (): Promise<boolean> => {
    const comment = joinComment(checkinDraftOf(workspacePath));
    if (!comment.trim() && settings.warnOnEmptyComment && !(await confirmCheckinWithoutComment())) {
      // Writing one is the way on.
      summaryRef.current?.focus();
      return false;
    }
    // Checking in takes the files as they are on disk: unsaved edits are saved first, or dropped, or it waits.
    if (!(await settleBeforeLeaving())) return false;
    if (bulkPrivate && !(await confirmBulkPrivateCheckin(bulkPrivate))) return false;
    const done = await runBusy(() => checkinChanges({
        workspacePath,
        changes: included,
        comment,
        updateFirst: behind !== null,
        quiet: successCardTellsCheckin(included.length, allChanges.length),
      }),);
    if (done) {
      clearMessage(workspacePath);
      setSelection(EMPTY_SELECTION);
    }
    return done;
  };

  // A shelve takes the files as they are on disk, as a checkin does. Shelved away, the changes take their comment along.
  const shelve = async (keep: boolean): Promise<boolean> => {
    if (!(await settleBeforeLeaving())) return false;
    const done = await runBusy(() => shelveChanges(workspacePath, shelvable, joinComment(checkinDraftOf(workspacePath)), keep));
    if (done && !keep) clearMessage(workspacePath);
    return done;
  };

  // With nothing pending, the empty state says so: no count, no ways to lay out a list that isn't there.
  const empty = snapshot?.changes.length === 0;
  const header = (
    <ViewHeader
      title="Changes"
      subtitle={snapshot && !empty && `${formatCount(pendingCount)} pending`}
      actions={
        <>
          <MyShelvesButton />
          <ReviewModeButton workspacePath={workspacePath} />
          <RefreshButton workspacePath={workspacePath} fetching={isFetching} />
          <IconButton icon={<SlidersHorizontal size={14} />} label="What to show" onClick={() => openSettingsDialogAt('pendingChanges')} />
        </>
      }
    >
      {!empty && (
        <>
          <SegmentedControl<ChangesGrouping>
            value={grouping}
            onChange={setGrouping}
            segments={[
              { value: 'none', label: 'Files' },
              { value: 'changelist', label: 'Changelists' },
            ]}
          />
          <SegmentedControl<ChangesLayout>
            value={layout}
            onChange={setLayout}
            segments={[
              { value: 'list', label: <List size={13} />, title: 'List' },
              { value: 'tree', label: <ListTree size={13} />, title: 'Tree' },
            ]}
          />
        </>
      )}
    </ViewHeader>
  );

  if (isLoading) return <>{header}<ListSkeleton rowHeight={28} /></>;
  if (error) return <>{header}<EmptyState title="Couldn't read pending changes" description={error.message} /></>;

  if (empty) {
    return (
      <>
        {header}
        <LeftChangesBanner />
        {successMoment && workspace && successMomentLeft(successMoment, Date.now()) > 0 ? (
          <SuccessCard
            moment={successMoment}
            repositoryName={workspace.repositoryName}
            server={workspace.server}
            onDone={() => clearSuccessMoment(workspacePath)}
          />
        ) : (
          <EmptyState
            icon={<CheckCircle2 size={24} />}
            title="No pending changes"
            description="Changes you make show up here."
            action={workspace?.selector.kind === 'branch' && <MergeTaskSuggestion workspacePath={workspacePath} branchName={workspace.selector.name} />}
          />
        )}
      </>
    );
  }

  return (
    <>
      {header}
      <LeftChangesBanner />
      {mergeChanges.length > 0 && (
        <div className={styles.mergeBanner}>
          <GitMerge size={14} />
          <span>
            A merge is in progress ({mergeChanges[0]!.mergeInfo}). Check in to complete it, or undo the changes to cancel it.
          </span>
        </div>
      )}
      <SplitPane
        initialSize={380}
        minSize={260}
        maxSize={720}
        first={
          <div className={styles.listPane}>
            <ChangesSummaryBar
              changes={changes}
              totalCount={snapshot?.changes.length ?? 0}
              isIncluded={isIncluded}
              onSetIncluded={setIncludedChanges}
              onUndo={(selected) => void undoChanges(workspacePath, selected)}
              onUndoUnchanged={() => void undoUnchangedCheckouts(workspacePath)}
              checkboxInset={checkboxInset}
            />
            {review.bar}
            {filterBar}
            {changes.length === 0 ? (
              <NoFilterMatches onClear={clearFilter} />
            ) : (
              <HighlightQuery query={query}>
                <ChangesList
                  rows={rows}
                  selection={selection}
                  onSelectionChange={(next) => selectAfterLeaving(selection, next, setSelection)}
                  isIncluded={isIncluded}
                  onToggleIncluded={toggleIncluded}
                  onToggleCollapsed={toggleCollapsed}
                  onOpen={(change) => openWithDefaultApp(workspacePath, change)}
                  onMoveToChangelist={
                    grouping === 'changelist' ? (moved, changelist) => void moveToChangelist(workspacePath, changelist, moved) : undefined
                  }
                  contextMenu={(selected) =>
                    pendingChangeMenu(workspacePath, selected, changelists, { isIncluded, setIncluded: setIncludedChanges }, review)
                  }
                  changelistMenu={(changelist) => changelistMenu(workspacePath, changelist)}
                  review={review}
                  locks={locks}
                />
              </HighlightQuery>
            )}
            {hiddenIncludedCount > 0 && <HiddenCheckedNotice count={hiddenIncludedCount} onClear={clearFilter} />}
            <LockedByOthersNotice changes={included} locks={locks} />
            {/* Files never checked in don't make a task unfinished: finishing it is offered as on a clean workspace. */}
            {branchName && onlyNeverCheckedIn && (
              <div className={styles.taskSuggestion}>
                <MergeTaskSuggestion workspacePath={workspacePath} branchName={branchName} quiet />
              </div>
            )}
            {bulkPrivate && (
              <BulkPrivateNotice
                bulk={bulkPrivate}
                onExclude={() => setIncludedChanges(bulkPrivate.changes, false)}
                onIgnoreFolder={(folder) => void addFilterRule(workspacePath, 'ignore', `/${folder}`)}
              />
            )}
            {checkinAfterUpdate && (
              <CheckinAfterUpdateNotice
                message={checkinAfterUpdate}
                busy={busy}
                onCheckin={() => void checkin()}
                onDismiss={() => forgetRejectedCheckin(workspacePath)}
              />
            )}
            <CheckinPanel
              summaryRef={summaryRef}
              workspacePath={workspacePath}
              includedCount={included.length}
              upload={upload}
              shelvable={{ count: shelvable.length, upload: shelvableUpload }}
              branchName={workspace?.selector.name ?? ''}
              merging={mergeChanges.length > 0}
              behindCount={behind?.count ?? 0}
              behindDescription={behind && behindDescription(behind)}
              allReviewed={review.on && reviewed.total > 0 && reviewed.reviewed === reviewed.total}
              recentComments={settings.recentComments}
              busy={busy}
              onCheckin={checkin}
              onShelve={shelve}
            />
          </div>
        }
        second={
          selectedCount > 1 ? (
            <EmptyState icon={<Files size={24} />} title={`${formatCount(selectedCount)} files selected`} description="Select a single file to see its diff." />
          ) : focused && diffChange ? (
            <ChangeDiffPanel workspacePath={workspacePath} change={diffChange} reviewMark={review.marks.get(diffChange.path)} />
          ) : focusedFolder && focusedFolder.type !== 'change' ? (
            <EmptyState
              icon={<Folder size={24} />}
              title={focusedFolder.type === 'group' ? focusedFolder.label : focusedFolder.path}
              description={`${pluralize(focusedFolder.changes.length, 'change')}. Select a file to see its diff.`}
            />
          ) : (
            <EmptyState title="Select a change" description="Pick a file on the left to see what changed." />
          )
        }
      />
    </>
  );
}

/** How many of the changes shown are selected: a selection can hold rows the filter now hides, and folders. */
function countSelected(selected: ReadonlySet<string>, shown: ReadonlyMap<string, PendingChange>): number {
  let count = 0;
  for (const key of selected) if (shown.has(key)) count++;
  return count;
}
