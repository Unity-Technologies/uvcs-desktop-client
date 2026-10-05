import { GitMerge } from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';
import type { PendingChange, PendingChangesSnapshot } from '@shared/domain/pendingChanges';
import type { WorkspaceInfo } from '@shared/domain/workspace';
import { useChangeFilter } from '../../components/useChangeFilter';
import { selectAfterLeaving } from '../../app/navigation/leaveGuard';
import { useViewSelection } from '../../app/navigation/viewSelectionStore';
import { useSettings } from '../../app/settings/useSettings';
import { singleSelection } from '../../lib/selection';
import { useSettledValue } from '../../lib/useSettled';
import { HighlightQuery } from '../../ui/Highlight';
import { SplitPane } from '../../ui/SplitPane';
import { useChangeset } from '../changesets/useChangeset';
import { useFileSteps } from '../diff/viewer/fileSteps';
import { useIncomingSummary } from '../incoming/useIncomingSummary';
import { MergeTaskSuggestion } from '../mergeTask/MergeTaskSuggestion';
import { reviewProgress } from '../review/reviewStatus';
import { BulkPrivateNotice } from './BulkPrivateNotice';
import { ChangeSelectionPane } from './ChangeSelectionPane';
import { ChangesList } from './ChangesList';
import { ChangesSummaryBar } from './ChangesSummaryBar';
import { CheckinAfterUpdateNotice } from './CheckinAfterUpdateNotice';
import { CheckinPanel } from './CheckinPanel';
import { HiddenCheckedNotice, NoFilterMatches } from './FilterNotices';
import { LockedByOthersNotice } from './locks/LockedByOthersNotice';
import { usePendingLocks } from './locks/usePendingLocks';
import type { PendingReview } from './review/usePendingReview';
import { behindBranch, behindDescription } from './checkinBehind';
import { checkinAfterUpdateMessage, useCheckinAfterUpdateStore } from './checkinAfterUpdate';
import { undoUnchangedCheckouts } from './checkinOperations';
import { matchesBranch } from './changeCategories';
import { changesUnderRow, type ChangeRow } from './changeRows';
import { changelistMenu } from './changelistMenu';
import { moveToChangelist } from './changelistOperations';
import { changeTones } from './changeTone';
import { checkinDraftOf, useCheckinDraftStore, useExcludedPaths } from './checkinDraftStore';
import { pendingChangeMenu } from './pendingChangeMenu';
import { addFilterRule, openChange, undoChanges } from './pendingChangeOperations';
import { usePendingChangesViewStore } from './pendingChangesViewStore';
import { useChangeRows } from './useChangeRows';
import { useCheckinPanelSubmit } from './useCheckinPanelSubmit';
import { useCheckinSelection } from './useCheckinSelection';
import { useSortedChanges } from './useSortedChanges';
import styles from './PendingChangesView.module.css';

const changePath = (change: PendingChange): string => change.path;

interface PendingChangesPanesProps {
  workspacePath: string;
  workspace: WorkspaceInfo | undefined;
  snapshot: PendingChangesSnapshot;
  /** Review mode on the changes: the view keeps it while nothing is pending too, to see bursts and drop old marks. */
  review: PendingReview;
  /** When the snapshot was read: locks are read again with the changes, at most every 30 s. */
  readAt: number;
}

/** Changes with something pending: the list and the check-in panel, beside the diff of the change selected. */
export function PendingChangesPanes({ workspacePath, workspace, snapshot, review, readAt }: PendingChangesPanesProps) {
  const { data: incomingSummary } = useIncomingSummary();
  const settings = useSettings();
  // Only what the list shows: dragging the description's height or typing the comment doesn't render the list again.
  const layout = usePendingChangesViewStore((state) => state.layout);
  const grouping = usePendingChangesViewStore((state) => state.grouping);
  const excludedPaths = useExcludedPaths(workspacePath);
  const setIncluded = useCheckinDraftStore((state) => state.setIncluded);
  const [selection, setSelection] = useViewSelection('changes');
  const summaryRef = useRef<HTMLInputElement>(null);

  const allChanges = snapshot.changes;
  const { changelists } = snapshot;
  const locks = usePendingLocks(workspacePath, workspace?.repository, allChanges, readAt);
  // Sorted once for the layout; filtering keeps the order, so typing in the filter or opening a folder never sorts again.
  const sorted = useSortedChanges(allChanges, layout);
  const { visible: filtered, query, clear: clearTextFilter, bar: filterBar } = useChangeFilter(sorted, changePath, changeTones, true);
  const changes = useMemo(() => review.narrow(filtered), [review.narrow, filtered]);
  const clearFilter = (): void => {
    clearTextFilter();
    review.showAll();
  };
  const { rows, changesByKey, fileKeys, checkboxInset, toggleCollapsed } = useChangeRows({ changes, changelists, layout, grouping });
  const { isIncluded, included, upload, shelvable, shelvableUpload, bulkPrivate } = useCheckinSelection(allChanges, excludedPaths);
  // The changes shown are some of all of them: the checked ones they leave out are the rest.
  const hiddenIncludedCount = useMemo(() => included.length - changes.filter(isIncluded).length, [changes, included, isIncluded]);
  const reviewed = useMemo(() => reviewProgress(included, review.statusOf), [included, review.statusOf]);
  const { mergeChanges, onlyNeverCheckedIn } = useMemo(
    () => ({ mergeChanges: allChanges.filter((change) => change.mergeInfo), onlyNeverCheckedIn: matchesBranch(allChanges) }),
    [allChanges],
  );
  const branchName = workspace?.selector.kind === 'branch' ? workspace.selector.name : undefined;
  const behind = behindBranch(incomingSummary, branchName, mergeChanges.length > 0);
  const checkinAfterUpdate = useCheckinAfterUpdate(workspacePath, workspace, branchName, included.length);
  const submit = useCheckinPanelSubmit(
    { workspacePath, included, pendingCount: allChanges.length, behind: behind !== null, bulkPrivate, warnOnEmptyComment: settings.warnOnEmptyComment },
    shelvable,
    summaryRef,
  );
  useMergeComment(workspacePath, snapshot);

  const focused = selection.anchor === null ? undefined : changesByKey.get(selection.anchor);
  // Holding ↓ moves through the list at once; the diff (a read and an editor to lay out) follows where it stops.
  const diffChange = useSettledValue(focused, selection.anchor ?? '') ?? focused;
  // A folder or changelist the keyboard (or a click) is on.
  const focusedFolder = focused ? undefined : rows.find((row): row is Exclude<ChangeRow, { type: 'change' }> => row.type !== 'change' && row.key === selection.anchor);
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

  const setIncludedChanges = (selected: PendingChange[], include: boolean): void =>
    setIncluded(workspacePath, selected.map((change) => change.path), include);
  const toggleIncluded = (toggled: ChangeRow[], include: boolean): void => setIncludedChanges(toggled.flatMap(changesUnderRow), include);

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
            <ChangesSummaryBar
              changes={changes}
              totalCount={allChanges.length}
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
                  onOpen={(change) => openChange(workspacePath, change)}
                  onMoveToChangelist={
                    grouping === 'changelist' ? (moved, changelist) => void moveToChangelist(workspacePath, changelist, moved) : undefined
                  }
                  contextMenu={(selected) =>
                    pendingChangeMenu(workspacePath, selected, changelists, { isIncluded, setIncluded: setIncludedChanges }, review, locks)
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
              upload={upload}
              shelvable={{ count: shelvable.length, upload: shelvableUpload }}
              branchName={workspace?.selector.name ?? ''}
              merging={mergeChanges.length > 0}
              behindCount={behind?.count ?? 0}
              behindDescription={behind && behindDescription(behind)}
              allReviewed={review.on && reviewed.total > 0 && reviewed.reviewed === reviewed.total}
              recentComments={settings.recentComments}
              busy={submit.busy}
              onCheckin={submit.checkin}
              onShelve={submit.shelve}
            />
          </div>
        }
        second={
          <ChangeSelectionPane
            workspacePath={workspacePath}
            selectedCount={countSelected(selection.selected, changesByKey)}
            diffChange={focused && diffChange}
            focusedFolder={focusedFolder}
            fileSteps={fileSteps}
            reviewMarks={review.marks}
          />
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

/** Checking in completes a pending merge: its comment starts with where the merge comes from, unless one is written. */
function useMergeComment(workspacePath: string, snapshot: PendingChangesSnapshot): void {
  const setMessage = useCheckinDraftStore((state) => state.setMessage);
  const { data: mergeSource } = useChangeset(snapshot.mergeLinks[0]?.sourceChangeset ?? null);
  useEffect(() => {
    const draft = checkinDraftOf(workspacePath);
    if (mergeSource && !draft.summary && !draft.description) setMessage(workspacePath, { summary: `Merged from ${mergeSource.branch}` });
  }, [mergeSource?.id]);
}

/** How many of the changes shown are selected: a selection can hold rows the filter now hides, and folders. */
function countSelected(selected: ReadonlySet<string>, shown: ReadonlyMap<string, PendingChange>): number {
  let count = 0;
  for (const key of selected) if (shown.has(key)) count++;
  return count;
}
