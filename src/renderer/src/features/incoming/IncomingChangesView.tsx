import { CheckCircle2, GitBranch, RefreshCw } from 'lucide-react';
import { invalidateWorkspace } from '../../app/queryClient';
import { useWorkspacePath } from '../../app/workspace/useWorkspace';
import { EmptyState } from '../../ui/EmptyState';
import { IconButton } from '../../ui/IconButton';
import { CenteredSpinner } from '../../ui/Spinner';
import { ViewHeader } from '../../ui/ViewHeader';
import { IncomingSession } from './IncomingSession';
import { useIncomingChanges } from './useIncomingChanges';

export function IncomingChangesView() {
  const workspacePath = useWorkspacePath();
  const { data: incoming, isLoading, isFetching, error } = useIncomingChanges();

  const header = (
    <ViewHeader
      title="Incoming"
      subtitle={incoming?.branch && (incoming.changesetCount > 0 ? `${incoming.changesetCount} new on ${incoming.branch}` : incoming.branch)}
      actions={<IconButton icon={<RefreshCw size={14} />} label="Refresh" loading={isFetching} onClick={() => void invalidateWorkspace(workspacePath)} />}
    />
  );

  if (isLoading) return <>{header}<CenteredSpinner /></>;
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
        <EmptyState icon={<CheckCircle2 size={22} />} title="You're up to date" />
      </>
    );
  }

  return <IncomingSession key={incoming.headChangeset} workspacePath={workspacePath} incoming={incoming} header={header} />;
}
