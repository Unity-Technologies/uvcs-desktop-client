import { CheckCircle2, GitBranch, RefreshCw } from 'lucide-react';
import { invalidateWorkspace } from '../../app/queryClient';
import { useWorkspacePath } from '../../app/workspace/useWorkspace';
import { branchLabel } from '../../lib/branchLabels';
import { EmptyState } from '../../ui/EmptyState';
import { IconButton } from '../../ui/IconButton';
import { ListSkeleton } from '../../ui/Skeleton';
import { ViewHeader } from '../../ui/ViewHeader';
import { IncomingPanes } from './IncomingPanes';
import { IncomingSession } from './IncomingSession';
import { useIncomingChanges } from './useIncomingChanges';

export function IncomingChangesView() {
  const workspacePath = useWorkspacePath();
  const { data: incoming, isPending, isFetching, error } = useIncomingChanges();

  // The session says how many came in, as its list knows them (`incomingSubtitle`); before, only the branch.
  const headerSaying = (words: string | undefined) => (
    <ViewHeader
      title="Incoming"
      subtitle={incoming?.branch && words && <span data-tip={incoming.branch}>{words}</span>}
      actions={<IconButton icon={<RefreshCw size={14} />} label="Refresh" loading={isFetching} onClick={() => void invalidateWorkspace(workspacePath)} />}
    />
  );
  const header = headerSaying(incoming?.branch ? branchLabel(incoming.branch) : undefined);

  // The panes keep their layout while reading and once up to date; not being on a branch, or failing, takes the body.
  if (isPending) {
    return (
      <>
        {header}
        <IncomingPanes list={<ListSkeleton rowHeight={28} />} detail={null} />
      </>
    );
  }
  if (error || !incoming) return <>{header}<EmptyState title="Couldn't check for incoming changes" description={error?.message} /></>;

  if (!incoming.branch) {
    return (
      <>
        {header}
        <EmptyState icon={<GitBranch size={22} />} title="Not on a branch" description="The workspace is loaded from a fixed point in history, so nothing new comes in." />
      </>
    );
  }

  if (incoming.changesetCount === 0) {
    return (
      <>
        {header}
        <IncomingPanes list={null} detail={<EmptyState icon={<CheckCircle2 size={22} />} title="You're up to date" />} />
      </>
    );
  }

  return <IncomingSession key={incoming.headChangeset} workspacePath={workspacePath} incoming={incoming} header={headerSaying} />;
}
