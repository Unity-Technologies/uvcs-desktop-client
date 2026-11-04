import { CheckCircle2, FileDiff, GitMerge } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { MergePlan } from '@shared/domain/merge';
import { navigation, useNavigation } from '../../app/navigation/navigationStore';
import type { PageProps } from '../../app/navigation/pages';
import { useWorkspacePath } from '../../app/workspace/useWorkspace';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { MergeCalculating } from './MergeCalculating';
import { MergeCompleted, type MergeCompletion } from './MergeCompleted';
import { MergeSession } from './MergeSession';
import { mergeSettled } from './mergeSettled';
import { useMergePlan } from './useMergePlan';

/** Previews a merge, walks the user through its conflicts and runs it. */
export function MergePage({ page }: PageProps<'merge'>) {
  const workspacePath = useWorkspacePath();
  const { data: plan, isLoading, error, refetch, isFetching } = useMergePlan(workspacePath, page.request);
  // Once merged into the workspace, the plan no longer holds (the workspace has pending changes): the page says what happened instead.
  const [completion, setCompletion] = useState<MergeCompletion>();
  // While the merge is in progress, leaving the page only sets it aside; once settled, leaving it closes it.
  const mergeId = useNavigation((state) => (state.merge?.page === page ? state.merge.id : undefined));
  const settled = mergeSettled(plan?.status, completion !== undefined);
  useEffect(() => {
    if (settled && mergeId !== undefined) navigation.settleMerge(mergeId);
  }, [settled, mergeId]);

  if (completion) return <MergeCompleted request={page.request} completion={completion} />;
  if (isLoading) return <MergeCalculating request={page.request} />;
  if (error || !plan) {
    return (
      <EmptyState
        icon={<GitMerge size={22} />}
        title="Couldn't prepare the merge"
        description={error?.message}
        action={
          <Button loading={isFetching} onClick={() => void refetch()}>
            Try again
          </Button>
        }
      />
    );
  }

  if (plan.status !== 'ready') return <MergeNotPossible plan={plan} />;
  return <MergeSession key={JSON.stringify(page.request)} workspacePath={workspacePath} request={page.request} initialPlan={plan} task={page.task} onCompleted={setCompletion} />;
}

function MergeNotPossible({ plan }: { plan: MergePlan }) {
  switch (plan.status) {
    case 'pendingChanges':
      return (
        <EmptyState
          icon={<FileDiff size={22} />}
          title="Check in or shelve your changes first"
          description="Merging into a workspace with pending changes could mix your work with the merge. Your changes are safe; deal with them first and come back."
          action={<Button onClick={() => navigation.goToView('changes')}>Go to Changes</Button>}
        />
      );
    case 'alreadyMerged':
      return <EmptyState icon={<CheckCircle2 size={22} />} title="Nothing to merge" description="The destination already has all these changes." />;
    default:
      return <EmptyState icon={<GitMerge size={22} />} title="This interval can't be merged" description="Check the changesets you picked and try again." />;
  }
}
