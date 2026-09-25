import { CheckCircle2, Files, GitMerge, List, ListTree, RefreshCw, SlidersHorizontal } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { PendingChange } from '@shared/domain/pendingChanges';
import { invalidateWorkspace } from '../../app/queryClient';
import { useChangeFilter } from '../../components/useChangeFilter';
import { openSettingsDialogAt } from '../../app/settings/SettingsDialog';
import { useSettings } from '../../app/settings/useSettings';
import { useWorkspaceInfo, useWorkspacePath } from '../../app/workspace/useWorkspace';
import { EMPTY_SELECTION, type SelectionState } from '../../lib/selection';
import { EmptyState } from '../../ui/EmptyState';
import { HighlightQuery } from '../../ui/Highlight';
import { IconButton } from '../../ui/IconButton';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { CenteredSpinner } from '../../ui/Spinner';
import { SplitPane } from '../../ui/SplitPane';
import { ViewHeader } from '../../ui/ViewHeader';
import { useChangeset } from '../changesets/useChangeset';
import { LeftChangesBanner } from '../leftChanges/LeftChangesBanner';
import { ChangeDiffPanel } from './ChangeDiffPanel';
import { ChangesList } from './ChangesList';
import { ChangesSummaryBar } from './ChangesSummaryBar';
import { CheckinAfterUpdateNotice } from './CheckinAfterUpdateNotice';
import { CheckinPanel } from './CheckinPanel';
import { HiddenCheckedNotice, NoFilterMatches } from './FilterNotices';
import { LiveRefreshToggle } from './LiveRefreshToggle';
import { LockedByOthersNotice } from './locks/LockedByOthersNotice';
import { usePendingLocks } from './locks/usePendingLocks';
import { useReviewMode } from './review/useReviewMode';
import { mergeSourceChangeset, uploadSize } from './checkinButton';
import { checkinAfterUpdateMessage, useCheckinAfterUpdateStore } from './checkinAfterUpdate';
import { checkinChanges, shelveChanges, undoUnchangedCheckouts } from './checkinOperations';
import { isCheckinCandidate } from './changeCategories';
import { buildChangeRows, changeKey, changesUnderRow, CHEVRON_SLOT, hasDisclosureRows, type ChangeRow, type ChangesGrouping, type ChangesLayout } from './changeRows';
import { changelistMenu } from './changelistMenu';
import { moveToChangelist } from './changelistOperations';
import { changeTone } from './changeTone';
import { checkinComment, useCheckinDraft, useCheckinDraftStore } from './checkinDraftStore';
import { pendingChangeMenu } from './pendingChangeMenu';
import { openWithDefaultApp, undoChanges } from './pendingChangeOperations';
import { usePendingChangesViewStore } from './pendingChangesViewStore';
import { usePendingChanges } from './usePendingChanges';
import styles from './PendingChangesView.module.css';

const NO_CHANGES: PendingChange[] = [];
const changePath = (change: PendingChange): string => change.path;

export function PendingChangesView() {
  const workspacePath = useWorkspacePath();
  const { data: workspace } = useWorkspaceInfo();
  const { data: snapshot, isLoading, isFetching, isPlaceholderData, dataUpdatedAt, error } = usePendingChanges();
  const settings = useSettings();
  const { layout, setLayout, grouping, setGrouping } = usePendingChangesViewStore();
  const draft = useCheckinDraft(workspacePath);
  const { setMessage, setIncluded, reset } = useCheckinDraftStore();

  const [selection, setSelection] = useState<SelectionState>(EMPTY_SELECTION);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const allChanges = snapshot?.changes ?? NO_CHANGES;
  const review = useReviewMode(workspacePath, allChanges, snapshot !== undefined && !isPlaceholderData);
  const locks = usePendingLocks(workspacePath, workspace?.repository, allChanges, dataUpdatedAt);
  const { visible: filtered, query, clear: clearTextFilter, bar: filterBar } = useChangeFilter(allChanges, changePath, changeTone);
  const changes = review.narrow(filtered);
  const clearFilter = (): void => {
    clearTextFilter();
    review.showAll();
  };
  const isIncluded = (change: PendingChange): boolean => isCheckinCandidate(change) && !draft.excludedPaths.has(change.path);
  // Check in takes every checked change, including those the filter hides: the filter only narrows what is shown.
  const included = allChanges.filter(isIncluded);
  const shown = new Set(changes);
  const hiddenIncludedCount = included.filter((change) => !shown.has(change)).length;
  const rejectedCheckin = useCheckinAfterUpdateStore((state) => state.rejected[workspacePath]);
  const forgetRejectedCheckin = useCheckinAfterUpdateStore((state) => state.forget);
  const checkinAfterUpdate = checkinAfterUpdateMessage(
    rejectedCheckin,
    { branch: workspace?.selector.kind === 'branch' ? workspace.selector.name : undefined, loadedChangeset: workspace?.loadedChangeset },
    included.length,
  );
  const selectedCount = changes.filter((change) => selection.selected.has(changeKey(change))).length;
  const changelists = snapshot?.changelists ?? [];
  const rows = buildChangeRows({ changes, changelists, layout, grouping, isChecked: isIncluded, collapsed });
  const focused = changes.find((change) => changeKey(change) === selection.anchor);
  const mergeChanges = allChanges.filter((change) => change.mergeInfo);
  const { data: mergeSource } = useChangeset(mergeSourceChangeset(mergeChanges));
  const firstChangeKey = rows.find((row) => row.type === 'change')?.key;

  // Keep something selected, so the diff pane is useful from the start and after the selected file goes away.
  useEffect(() => {
    if (!focused && firstChangeKey) setSelection({ selected: new Set([firstChangeKey]), anchor: firstChangeKey });
  }, [focused, firstChangeKey]);

  const setIncludedChanges = (selected: PendingChange[], include: boolean): void =>
    setIncluded(workspacePath, selected.map((change) => change.path), include);
  const toggleIncluded = (row: ChangeRow, include: boolean): void => setIncludedChanges(changesUnderRow(row), include);

  // Checking in completes a pending merge: start its comment with where the merge comes from.
  useEffect(() => {
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
    const done = await runBusy(() =>
      checkinChanges({ workspacePath, changes: included, comment: checkinComment(draft), warnOnEmptyComment: settings.warnOnEmptyComment }),
    );
    if (done) {
      reset(workspacePath);
      setSelection(EMPTY_SELECTION);
    }
    return done;
  };

  const header = (
    <ViewHeader
      title="Changes"
      subtitle={snapshot && `${snapshot.changes.filter(isCheckinCandidate).length} pending`}
      actions={
        <>
          <LiveRefreshToggle />
          <IconButton icon={<RefreshCw size={14} className={isFetching ? styles.spinning : undefined} />} label="Refresh" shortcut="mod+r" onClick={() => void invalidateWorkspace(workspacePath)} />
          <IconButton icon={<SlidersHorizontal size={14} />} label="What to show" onClick={() => openSettingsDialogAt('pendingChanges')} />
        </>
      }
    >
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
    </ViewHeader>
  );

  if (isLoading) return <>{header}<CenteredSpinner /></>;
  if (error) return <>{header}<EmptyState title="Couldn't read pending changes" description={error.message} /></>;

  if (snapshot?.changes.length === 0) {
    return (
      <>
        {header}
        <LeftChangesBanner />
        <EmptyState
          icon={<CheckCircle2 size={24} />}
          title="No pending changes"
          description={`Your workspace matches ${workspace?.selector.name ?? 'the repository'}. Changes you make to files show up here automatically.`}
        />
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
              checkboxInset={hasDisclosureRows(rows) ? CHEVRON_SLOT : 0}
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
                  onSelectionChange={setSelection}
                  onToggleIncluded={toggleIncluded}
                  onToggleCollapsed={toggleCollapsed}
                  onOpen={(change) => openWithDefaultApp(workspacePath, change)}
                  onMoveToChangelist={
                    grouping === 'changelist' ? (moved, changelist) => void moveToChangelist(workspacePath, changelist, moved) : undefined
                  }
                  contextMenu={(selected) =>
                    pendingChangeMenu(workspacePath, selected, changelists, { isIncluded, setIncluded: setIncludedChanges }, { marks: review.marks, toggle: review.toggle })
                  }
                  changelistMenu={(changelist) => changelistMenu(workspacePath, changelist)}
                  reviewMarks={review.marks}
                  onToggleReviewed={review.toggle}
                  locks={locks}
                />
              </HighlightQuery>
            )}
            {hiddenIncludedCount > 0 && <HiddenCheckedNotice count={hiddenIncludedCount} onClear={clearFilter} />}
            <LockedByOthersNotice changes={included} locks={locks} />
            {checkinAfterUpdate && (
              <CheckinAfterUpdateNotice
                message={checkinAfterUpdate}
                busy={busy}
                onCheckin={() => void checkin()}
                onDismiss={() => forgetRejectedCheckin(workspacePath)}
              />
            )}
            <CheckinPanel
              summary={draft.summary}
              description={draft.description}
              onMessageChange={(message) => setMessage(workspacePath, message)}
              includedCount={included.length}
              uploadBytes={uploadSize(included)}
              branchName={workspace?.selector.name ?? ''}
              merging={mergeChanges.length > 0}
              recentComments={settings.recentComments}
              busy={busy}
              onCheckin={checkin}
              onShelve={() => runBusy(() => shelveChanges(workspacePath, included, checkinComment(draft)))}
            />
          </div>
        }
        second={
          selectedCount > 1 ? (
            <EmptyState icon={<Files size={24} />} title={`${selectedCount} files selected`} description="Select a single file to see its diff." />
          ) : focused ? (
            <ChangeDiffPanel workspacePath={workspacePath} change={focused} reviewMark={review.marks.get(focused.path)} />
          ) : (
            <EmptyState title="Select a change" description="Pick a file on the left to see what changed." />
          )
        }
      />
    </>
  );
}
