import { CheckCircle2, GitMerge, List, ListTree, RefreshCw, SlidersHorizontal } from 'lucide-react';
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
import { ChangeDiffPanel } from './ChangeDiffPanel';
import { ChangesList } from './ChangesList';
import { CheckinPanel } from './CheckinPanel';
import { checkinChanges, shelveChanges, undoUnchangedCheckouts } from './checkinOperations';
import { isCheckinCandidate } from './changeCategories';
import { buildChangeRows, changeKey, changesUnderRow, type ChangeRow, type ChangesGrouping, type ChangesLayout } from './changeRows';
import { changelistMenu } from './changelistMenu';
import { changeTone } from './changeTone';
import { useCheckinDraft, useCheckinDraftStore } from './checkinDraftStore';
import { pendingChangeMenu } from './pendingChangeMenu';
import { usePendingChangesViewStore } from './pendingChangesViewStore';
import { usePendingChanges } from './usePendingChanges';
import styles from './PendingChangesView.module.css';

const NO_CHANGES: PendingChange[] = [];
const changePath = (change: PendingChange): string => change.path;

export function PendingChangesView() {
  const workspacePath = useWorkspacePath();
  const { data: workspace } = useWorkspaceInfo();
  const { data: snapshot, isLoading, isFetching, error } = usePendingChanges();
  const settings = useSettings();
  const { layout, setLayout, grouping, setGrouping } = usePendingChangesViewStore();
  const draft = useCheckinDraft(workspacePath);
  const { setComment, setIncluded, reset } = useCheckinDraftStore();

  const [selection, setSelection] = useState<SelectionState>(EMPTY_SELECTION);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const [checkingIn, setCheckingIn] = useState(false);

  const { visible: changes, query, bar: filterBar } = useChangeFilter(snapshot?.changes ?? NO_CHANGES, changePath, changeTone);
  const isIncluded = (change: PendingChange): boolean => isCheckinCandidate(change) && !draft.excludedPaths.has(change.path);
  const included = changes.filter(isIncluded);
  const changelists = snapshot?.changelists ?? [];
  const rows = buildChangeRows({ changes, changelists, layout, grouping, isChecked: isIncluded, collapsed });
  const focused = changes.find((change) => changeKey(change) === selection.anchor);
  const mergeChanges = changes.filter((change) => change.mergeInfo);
  const firstChangeKey = rows.find((row) => row.type === 'change')?.key;

  // Keep something selected, so the diff pane is useful from the start and after the selected file goes away.
  useEffect(() => {
    if (!focused && firstChangeKey) setSelection({ selected: new Set([firstChangeKey]), anchor: firstChangeKey });
  }, [focused, firstChangeKey]);

  const toggleIncluded = (row: ChangeRow, include: boolean): void =>
    setIncluded(workspacePath, changesUnderRow(row).map((change) => change.path), include);

  const toggleCollapsed = (key: string): void =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const checkin = async (): Promise<void> => {
    setCheckingIn(true);
    const done = await checkinChanges({ workspacePath, changes: included, comment: draft.comment, warnOnEmptyComment: settings.warnOnEmptyComment });
    setCheckingIn(false);
    if (done) {
      reset(workspacePath);
      setSelection(EMPTY_SELECTION);
    }
  };

  const header = (
    <ViewHeader
      title="Changes"
      subtitle={snapshot && `${snapshot.changes.filter(isCheckinCandidate).length} pending`}
      actions={
        <>
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
            {filterBar}
            <HighlightQuery query={query}>
              <ChangesList
                rows={rows}
                selection={selection}
                onSelectionChange={setSelection}
                onToggleIncluded={toggleIncluded}
                onToggleCollapsed={toggleCollapsed}
                onOpen={(change) => setSelection({ selected: new Set([changeKey(change)]), anchor: changeKey(change) })}
                contextMenu={(selected) => pendingChangeMenu(workspacePath, selected, changelists)}
                changelistMenu={(changelist) => changelistMenu(workspacePath, changelist)}
              />
            </HighlightQuery>
            <CheckinPanel
              comment={draft.comment}
              onCommentChange={(comment) => setComment(workspacePath, comment)}
              includedCount={included.length}
              branchName={workspace?.selector.name ?? ''}
              recentComments={settings.recentComments}
              busy={checkingIn}
              onCheckin={() => void checkin()}
              onShelve={() => void shelveChanges(workspacePath, included, draft.comment)}
              onUndoUnchanged={() => void undoUnchangedCheckouts(workspacePath)}
            />
          </div>
        }
        second={
          focused ? (
            <ChangeDiffPanel workspacePath={workspacePath} change={focused} />
          ) : (
            <EmptyState title="Select a change" description="Pick a file on the left to see what changed." />
          )
        }
      />
    </>
  );
}
