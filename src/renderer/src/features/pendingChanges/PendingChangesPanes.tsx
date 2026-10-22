import { GitMerge } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import type { Changelist, PendingChange, PendingChangesSnapshot } from '@shared/domain/pendingChanges';
import type { WorkspaceInfo } from '@shared/domain/workspace';
import { folderListScope } from '../../components/collapsedFoldersStore';
import { useChangeFilter } from '../../components/useChangeFilter';
import { useFileListLayoutStore } from '../../components/fileListLayoutStore';
import { selectAfterLeaving } from '../../app/navigation/leaveGuard';
import { useViewSelection } from '../../app/navigation/viewSelectionStore';
import { useSettings } from '../../app/settings/useSettings';
import { branchWorkedOn } from '../../components/workingObject';
import { singleSelection } from '../../lib/selection';
import { useSettledValue } from '../../lib/useSettled';
import { HighlightQuery } from '../../ui/Highlight';
import { NoMatches } from '../../ui/NoMatches';
import { ListSkeleton } from '../../ui/Skeleton';
import { SplitPane } from '../../ui/SplitPane';
import { useChangeset } from '../changesets/useChangeset';
import { useFileSteps } from '../diff/viewer/fileSteps';
import { useKnownIncomingSummary } from '../incoming/useKnownIncomingSummary';
import { MergeTaskSuggestion } from '../mergeTask/MergeTaskSuggestion';
import { ReviewModeButton } from '../review/ReviewModeButton';
import { reviewProgress } from '../review/reviewStatus';
import { BulkPrivateNotice } from './BulkPrivateNotice';
import { ChangeSelectionPane } from './ChangeSelectionPane';
import { ChangesList } from './ChangesList';
import { ChangesSummaryBar } from './ChangesSummaryBar';
import { CheckinAfterUpdateNotice } from './CheckinAfterUpdateNotice';
import { CheckinPanel } from './CheckinPanel';
import { LockedByOthersNotice } from './locks/LockedByOthersNotice';
import { usePendingLocks } from './locks/usePendingLocks';
import type { PendingReview } from './review/usePendingReview';
import { behindBranch, behindDescription } from './checkinBehind';
import { checkinAfterUpdateMessage, useCheckinAfterUpdateStore } from './checkinAfterUpdate';
import { undoUnchangedCheckouts } from './checkinOperations';
import { matchesBranch } from './changeCategories';
import { changesUnderRow, type ChangeRow } from './changeRows';
import { indexPending, pathsCheckedTogether } from './checkinDependencies';
import { changesPanesState } from './changesPanesState';
import { changesByChangelist, prepareChangelistCheckin } from './changelistCheckin';
import { changelistMenu } from './changelistMenu';
import { moveToChangelist } from './changelistOperations';
import { changeTones } from './changeTone';
import { checkinDraftOf, useCheckinChoice, useCheckinDraftStore } from './checkinDraftStore';
import { pendingChangeMenu } from './pendingChangeMenu';
import { addFilterRules, openChange, undoChanges } from './pendingChangeOperations';
import { usePendingChangesViewStore } from './pendingChangesViewStore';
import { useChangeRows } from './useChangeRows';
import { useCheckinPanelSubmit } from './useCheckinPanelSubmit';
import type { CheckinMode } from './checkinButton';
import { checkinFactsOf, currentChoice, type PreparedChangelist, preparedStillPending } from './checkinSelection';
import { useCheckinSelection } from './useCheckinSelection';
import { useSortedChanges } from './useSortedChanges';
import styles from './PendingChangesView.module.css';

const changePath = (change: PendingChange): string => change.path;
const NO_CHANGES: PendingChange[] = [];
const NO_CHANGELISTS: Changelist[] = [];

interface PendingChangesPanesProps {
  workspacePath: string;
  workspace: WorkspaceInfo | undefined;
  /** The changes read; undefined until they are read the first time, while the list shows a skeleton of its rows. */
  snapshot: PendingChangesSnapshot | undefined;
  /** Beside the list, where the diff goes, once nothing is pending: the empty state, or what was just checked in. */
  nothingPending: ReactNode;
  /** Review mode on the changes: the view keeps it while nothing is pending too, to see bursts and drop old marks. */
  review: PendingReview;
  /** When the snapshot was read: locks are read again with the changes, at most every 30 s. */
  readAt: number;
}

/**
 * The list of changes and the check-in panel, beside the diff of the change selected. It keeps this shape from the
 * first read on: a skeleton of rows while the changes load, and "0 files" beside `nothingPending` once nothing is.
 */
export function PendingChangesPanes({ workspacePath, workspace, snapshot, nothingPending, review, readAt }: PendingChangesPanesProps) {
  const incomingSummary = useKnownIncomingSummary();
  const settings = useSettings();
  // Only what the list shows: dragging the description's height or typing the comment doesn't render the list again.
  const layout = useFileListLayoutStore((state) => state.layout);
  const grouping = usePendingChangesViewStore((state) => state.grouping);
  const checkinChoice = useCheckinChoice(workspacePath);
  const setIncluded = useCheckinDraftStore((state) => state.setIncluded);
  const includeEverything = useCheckinDraftStore((state) => state.includeEverything);
  const [selection, setSelection] = useViewSelection('changes');
  const summaryRef = useRef<HTMLInputElement>(null);
  // Back to checking in each time Changes shows, as a shelve is a detour.
  const [checkinMode, setCheckinMode] = useState<CheckinMode>('checkin');

  const allChanges = snapshot?.changes ?? NO_CHANGES;
  const changelists = snapshot?.changelists ?? NO_CHANGELISTS;
  const changelistChanges = useMemo(() => changesByChangelist(allChanges), [allChanges]);
  const locks = usePendingLocks(workspacePath, workspace?.repository, allChanges, readAt);
  // Sorted once for the layout; filtering keeps the order, so typing in the filter or opening a folder never sorts again.
  const sorted = useSortedChanges(allChanges);
  const { visible: filtered, query, clear: clearChangeFilter, bar: filterBar } = useChangeFilter(sorted, changePath, changeTones, { isViewFilter: true, reading: !snapshot, actions: <ReviewModeButton workspacePath={workspacePath} /> });
  const changes = useMemo(() => review.narrow(filtered), [review.narrow, filtered]);
  const clearFilter = (): void => {
    clearChangeFilter();
    review.showAll();
  };
  const { rows, changesByKey, fileKeys, checkboxInset, toggleCollapsed } = useChangeRows({ changes, changelists, layout, grouping, scope: folderListScope(workspacePath, 'changes') });
  // The sorted list, which the filter gives back as it is when nothing filters: nothing is hidden to count.
  // Indexed once per read of the changes: checking a box looks up only the folders above what was clicked.
  const index = useMemo(() => indexPending(sorted), [sorted]);
  const facts = useMemo(() => checkinFactsOf(sorted), [sorted]);
  const listed = useMemo(() => ({ all: sorted, matchingFilter: filtered, index, facts }), [sorted, filtered, index, facts]);
  const { isIncluded, included, hiddenIncludedCount, upload, shelvable, shelvableUpload, bulkPrivate } = useCheckinSelection(listed, checkinChoice);
  const reviewed = useMemo(() => reviewProgress(included, review.statusOf), [included, review.statusOf]);
  const { mergeChanges, onlyNeverCheckedIn } = useMemo(
    () => ({ mergeChanges: allChanges.filter((change) => change.mergeInfo), onlyNeverCheckedIn: allChanges.length > 0 && matchesBranch(allChanges) }),
    [allChanges],
  );
  const branchName = branchWorkedOn(workspace?.selector);
  const behind = behindBranch(incomingSummary, branchName, mergeChanges.length > 0);
  const checkinAfterUpdate = useCheckinAfterUpdate(workspacePath, workspace, branchName, included.length);
  const submit = useCheckinPanelSubmit(
    { workspacePath, included, hiddenIncludedCount, allChanges, behind: behind !== null, bulkPrivate, warnOnEmptyComment: settings.warnOnEmptyComment },
    shelvable,
    summaryRef,
  );
  useMergeComment(workspacePath, snapshot);
  useEndPreparedWhenGone(workspacePath, snapshot, checkinChoice.prepared);
  const preparedChangelist = useMemo(() => currentChoice(checkinChoice, allChanges).prepared?.name ?? null, [checkinChoice, allChanges]);

  const focused = selection.anchor === null ? undefined : changesByKey.get(selection.anchor);
  // Holding ↓ moves through the list at once; the diff (a read and an editor to lay out) follows where it stops.
  const diffChange = useSettledValue(focused, selection.anchor ?? '') ?? focused;
  // A folder or changelist the keyboard (or a click) is on.
  const focusedFolder = focused ? undefined : rows.find((row): row is Exclude<ChangeRow, { type: 'file' }> => row.type !== 'file' && row.key === selection.anchor);
  const fileSteps = useFileSteps({
    keys: fileKeys,
    current: selection.anchor,
    select: (key) => selectAfterLeaving(selection, singleSelection(key), setSelection),
    pathOf: (key) => changesByKey.get(key)?.path ?? key,
  });

  // Keep something selected, so the diff pane is useful from the start and after the selected file goes away.
  const firstChangeKey = fileKeys[0];
  useEffect(() => {
    if (!focused && !focusedFolder && firstChangeKey) setSelection(singleSelection(firstChangeKey));
  }, [focused, focusedFolder, firstChangeKey]);

  // What the clicked changes need goes with them, and what needs them comes out with them (`pathsCheckedTogether`).
  const setIncludedChanges = (selected: PendingChange[], include: boolean): void =>
    setIncluded(workspacePath, pathsCheckedTogether(selected, include, index), include);
  // The header's box with nothing hidden means every file: it ends a prepared changelist instead of growing it.
  const setEveryShownIncluded = (shown: PendingChange[], include: boolean): void => {
    if (include && changes.length === allChanges.length) includeEverything(workspacePath, shown.map((change) => change.path));
    else setIncludedChanges(shown, include);
  };
  const toggleIncluded = (toggled: ChangeRow[], include: boolean): void => setIncludedChanges(toggled.flatMap(changesUnderRow), include);

  // The changelist's changes checked alone, then the caret after the comment: writing or reading it is the way on.
  const prepareChangelist = (changelist: Changelist, mode: CheckinMode): void => {
    // Rendered at once, so the summary holds the comment before the caret goes after it.
    flushSync(() => {
      prepareChangelistCheckin({ workspacePath, changelist, changes: changelistChanges.get(changelist.name) ?? NO_CHANGES, index, changelists, clearFilter });
      setCheckinMode(mode);
    });
    focusAtEnd(summaryRef.current);
  };

  const listedCount = snapshot && allChanges.length;
  const panesState = changesPanesState(listedCount, changes.length);
  const listBody =
    panesState === 'reading' ? (
      <ListSkeleton rowHeight={28} />
    ) : panesState === 'nothingPending' ? (
      <div className={styles.nothingListed} />
    ) : panesState === 'noMatches' ? (
      <NoMatches noun="changes" onClear={clearFilter} />
    ) : (
      <HighlightQuery query={query}>
        <ChangesList
          rows={rows}
          selection={selection}
          onSelectionChange={(next) => selectAfterLeaving(selection, next, setSelection)}
          isIncluded={isIncluded}
          onToggleIncluded={toggleIncluded}
          onToggleCollapsed={toggleCollapsed}
          onOpen={(change) => openChange(workspacePath, change)}
          onMoveToChangelist={
            grouping === 'changelist' ? (moved, changelist) => void moveToChangelist(workspacePath, changelist, moved) : undefined
          }
          contextMenu={(selected) =>
            pendingChangeMenu(workspacePath, selected, changelists, { isIncluded, setIncluded: setIncludedChanges }, review, locks)
          }
          changelistMenu={(changelist) =>
            changelistMenu(workspacePath, changelist, {
              changes: changelistChanges.get(changelist.name) ?? NO_CHANGES,
              prepare: (mode) => prepareChangelist(changelist, mode),
            })
          }
          review={review}
          locks={locks}
        />
      </HighlightQuery>
    );

  return (
    <>
      {mergeChanges.length > 0 && (
        <div className={styles.mergeBanner}>
          <GitMerge size={14} />
          <span>A merge is in progress ({mergeChanges[0]!.mergeInfo}). Check in to complete it, or undo the changes to cancel it.</span>
        </div>
      )}
      <SplitPane
        initialSize={380}
        minSize={260}
        maxSize={720}
        first={
          <div className={styles.listPane}>
            {/* Narrow the list first, then act on what's left: the summary's checkbox and undo sit right above the rows they act on. */}
            {filterBar}
            {review.bar}
            <ChangesSummaryBar
              changes={changes}
              totalCount={listedCount}
              isIncluded={isIncluded}
              onSetIncluded={setEveryShownIncluded}
              onUndo={(selected) => void undoChanges(workspacePath, selected)}
              onUndoUnchanged={() => void undoUnchangedCheckouts(workspacePath)}
              checkboxInset={checkboxInset}
            />
            {listBody}
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
                onIgnoreFolder={(folder) => void addFilterRules(workspacePath, 'ignore', [`/${folder}`])}
              />
            )}
            {checkinAfterUpdate && (
              <CheckinAfterUpdateNotice
                message={checkinAfterUpdate.message}
                busy={submit.busy}
                onCheckin={() => void submit.checkin()}
                onDismiss={checkinAfterUpdate.dismiss}
              />
            )}
            <CheckinPanel
              summaryRef={summaryRef}
              workspacePath={workspacePath}
              includedCount={included.length}
              hiddenIncludedCount={hiddenIncludedCount}
              listedCount={listedCount}
              upload={upload}
              shelvable={{ count: shelvable.length, upload: shelvableUpload }}
              workingOn={workspace?.selector}
              merging={mergeChanges.length > 0}
              behindCount={behind?.count ?? 0}
              behindDescription={behind && behindDescription(behind)}
              preparedChangelist={preparedChangelist}
              allReviewed={review.on && reviewed.total > 0 && reviewed.reviewed === reviewed.total}
              recentComments={settings.recentComments}
              mode={checkinMode}
              onModeChange={setCheckinMode}
              busy={submit.busy}
              onCheckin={submit.checkin}
              onShelve={submit.shelve}
            />
          </div>
        }
        second={
          panesState === 'reading' || panesState === 'noMatches' ? null : panesState === 'nothingPending' ? (
            nothingPending
          ) : (
            <ChangeSelectionPane
              workspacePath={workspacePath}
              selectedCount={countSelected(selection.selected, changesByKey)}
              diffChange={focused && diffChange}
              focusedFolder={focusedFolder}
              fileSteps={fileSteps}
              reviewMarks={review.marks}
            />
          )
        }
      />
    </>
  );
}

/** "Updated to cs:43 · Check in your 4 changes now?" once the workspace updated past a rejected check-in, and its dismissal. */
function useCheckinAfterUpdate(workspacePath: string, workspace: WorkspaceInfo | undefined, branchName: string | undefined, includedCount: number) {
  const rejectedCheckin = useCheckinAfterUpdateStore((state) => state.rejected[workspacePath]);
  const forget = useCheckinAfterUpdateStore((state) => state.forget);
  const message = checkinAfterUpdateMessage(rejectedCheckin, { branch: branchName, loadedChangeset: workspace?.loadedChangeset ?? undefined }, includedCount);
  return message ? { message, dismiss: () => forget(workspacePath) } : null;
}

/**
 * Ends a prepared changelist once none of its files is pending (`preparedStillPending`), so changes made later are
 * checked as usual; until then `currentChoice` already reads it so.
 */
function useEndPreparedWhenGone(workspacePath: string, snapshot: PendingChangesSnapshot | undefined, prepared: PreparedChangelist | null): void {
  const endPrepared = useCheckinDraftStore((state) => state.endPrepared);
  useEffect(() => {
    if (snapshot && prepared && !preparedStillPending(prepared, snapshot.changes)) endPrepared(workspacePath);
  }, [snapshot, prepared]);
}

/** Checking in completes a pending merge: its comment starts with where the merge comes from, unless one is written. */
function useMergeComment(workspacePath: string, snapshot: PendingChangesSnapshot | undefined): void {
  const setMessage = useCheckinDraftStore((state) => state.setMessage);
  const { data: mergeSource } = useChangeset(snapshot?.mergeLinks[0]?.sourceChangeset ?? null);
  useEffect(() => {
    const draft = checkinDraftOf(workspacePath);
    if (mergeSource && !draft.summary && !draft.description) setMessage(workspacePath, { summary: `Merged from ${mergeSource.branch}` });
  }, [mergeSource?.id]);
}

/** Puts the caret at the end of the field's text, as after typing it. */
function focusAtEnd(field: HTMLInputElement | null): void {
  if (!field) return;
  field.focus();
  field.setSelectionRange(field.value.length, field.value.length);
}

/** How many of the changes shown are selected: a selection can hold rows the filter now hides, and folders. */
function countSelected(selected: ReadonlySet<string>, shown: ReadonlyMap<string, PendingChange>): number {
  let count = 0;
  for (const key of selected) if (shown.has(key)) count++;
  return count;
}
