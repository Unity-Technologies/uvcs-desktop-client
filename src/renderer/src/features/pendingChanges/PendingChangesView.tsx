import { CheckCircle2 } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import type { PendingChange } from '@shared/domain/pendingChanges';
import { useWorkspaceInfo, useWorkspacePath } from '../../app/workspace/useWorkspace';
import { EmptyState } from '../../ui/EmptyState';
import { ListSkeleton } from '../../ui/Skeleton';
import { LeftChangesBanner } from '../leftChanges/LeftChangesBanner';
import { MergeTaskSuggestion } from '../mergeTask/MergeTaskSuggestion';
import { isCheckinCandidate } from './changeCategories';
import { PendingChangesHeader } from './PendingChangesHeader';
import { PendingChangesPanes } from './PendingChangesPanes';
import { usePendingReview } from './review/usePendingReview';
import { SuccessEmptyState } from './SuccessEmptyState';
import { isMomentOver, useSuccessMomentStore } from './successMoment';
import { usePendingChanges } from './usePendingChanges';

const NO_CHANGES: PendingChange[] = [];

export function PendingChangesView() {
  const workspacePath = useWorkspacePath();
  const { data: workspace, dataUpdatedAt: workspaceReadAt } = useWorkspaceInfo();
  const { data: snapshot, isLoading, isFetching, isPlaceholderData, dataUpdatedAt, error } = usePendingChanges();
  const allChanges = snapshot?.changes ?? NO_CHANGES;
  // Kept while nothing is pending too: a burst of changes counts from the empty workspace, and checked-in files lose their marks.
  const review = usePendingReview(workspacePath, allChanges, snapshot !== undefined && !isPlaceholderData);
  const pendingCount = useMemo(() => allChanges.filter(isCheckinCandidate).length, [allChanges]);
  const successMoment = useSuccessMomentStore((state) => state.moments[workspacePath]);
  const clearSuccessMoment = useSuccessMomentStore((state) => state.clear);

  // The next change ends the success moment, and so does the workspace moving to another changeset.
  const loadedChangeset = workspace?.loadedChangeset;
  useEffect(() => {
    const workspaceRead = loadedChangeset === undefined ? undefined : { readAt: workspaceReadAt, loadedChangeset };
    if (successMoment && isMomentOver(successMoment, { readAt: dataUpdatedAt, count: allChanges.length }, workspaceRead)) clearSuccessMoment(workspacePath);
  }, [successMoment, dataUpdatedAt, allChanges.length, workspaceReadAt, loadedChangeset]);

  const empty = snapshot?.changes.length === 0;
  const header = <PendingChangesHeader workspacePath={workspacePath} pendingCount={snapshot && pendingCount} empty={empty} fetching={isFetching} />;

  if (isLoading) return <>{header}<ListSkeleton rowHeight={28} /></>;
  if (error) return <>{header}<EmptyState title="Couldn't read pending changes" description={error.message} /></>;
  if (!snapshot) return header;

  if (empty) {
    const suggestion = workspace?.selector.kind === 'branch' && <MergeTaskSuggestion workspacePath={workspacePath} branchName={workspace.selector.name} />;
    return (
      <>
        {header}
        <LeftChangesBanner />
        {successMoment && workspace ? (
          <SuccessEmptyState moment={successMoment} repositoryName={workspace.repositoryName} server={workspace.server} suggestion={suggestion} />
        ) : (
          <EmptyState icon={<CheckCircle2 size={24} />} title="No pending changes" description="Changes you make show up here." action={suggestion} />
        )}
      </>
    );
  }

  return (
    <>
      {header}
      <LeftChangesBanner />
      <PendingChangesPanes workspacePath={workspacePath} workspace={workspace} snapshot={snapshot} review={review} readAt={dataUpdatedAt} />
    </>
  );
}
