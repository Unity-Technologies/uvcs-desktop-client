import { AlertCircle, CheckCircle2, GitBranch, RefreshCw } from 'lucide-react';
import { invalidateWorkspace } from '../../app/queryClient';
import { useWorkspacePath } from '../../app/workspace/useWorkspace';
import { branchLabel } from '../../lib/branchLabels';
import { EmptyState } from '../../ui/EmptyState';
import { IconButton } from '../../ui/IconButton';
import { ListSkeleton } from '../../ui/Skeleton';
import { ViewHeader } from '../../ui/ViewHeader';
import { IncomingChangesetsHeading } from './IncomingChangesetsHeading';
import { IncomingPanes } from './IncomingPanes';
import { IncomingSession } from './IncomingSession';
import { incomingHeaderSubtitle, incomingViewState } from './incomingViewState';
import { useIncomingChanges } from './useIncomingChanges';
import styles from './IncomingChangesView.module.css';

export function IncomingChangesView() {
  const workspacePath = useWorkspacePath();
  const { data: incoming, isPending, isFetching, error } = useIncomingChanges();

  // The session says how many came in, as its list knows them (`incomingSubtitle`); before, only the branch.
  // A check that failed after one that answered says so first, beside what that one read, which the view keeps: a long
  // branch name gives way before it.
  const headerSaying = (words: string | undefined) => {
    const subtitle = incomingHeaderSubtitle(incoming, words, error !== null);
    return (
      <ViewHeader
        title="Incoming"
        subtitle={
          subtitle && (
            <>
              {subtitle.refreshFailed && (
                <span className={styles.refreshFailed} data-tip={error?.message}>
                  <AlertCircle size={12} /> Couldn't check again
                </span>
              )}
              {subtitle.branchWords && <span data-tip={subtitle.branchWords.branch}>{subtitle.branchWords.words}</span>}
            </>
          )
        }
        actions={<IconButton icon={<RefreshCw size={14} />} label="Refresh" loading={isFetching} onClick={() => void invalidateWorkspace(workspacePath)} />}
      />
    );
  };
  const header = headerSaying(incoming?.branch ? branchLabel(incoming.branch) : undefined);

  // The panes keep their layout while reading and once up to date; not being on a branch, or failing with nothing
  // read, takes the body.
  const state = incomingViewState(incoming, isPending, error !== null);
  if (state.kind === 'reading') {
    return (
      <>
        {header}
        <IncomingPanes
          list={
            <>
              <IncomingChangesetsHeading count={undefined} />
              <ListSkeleton rowHeight={28} />
            </>
          }
          detail={null}
        />
      </>
    );
  }
  if (state.kind === 'failed') return <>{header}<EmptyState title="Couldn't check for incoming changes" description={error?.message} /></>;

  if (state.kind === 'notOnBranch') {
    return (
      <>
        {header}
        <EmptyState icon={<GitBranch size={22} />} title="Not on a branch" description="The workspace is loaded from a fixed point in history, so nothing new comes in." />
      </>
    );
  }

  if (state.kind === 'upToDate') {
    return (
      <>
        {header}
        <IncomingPanes list={<IncomingChangesetsHeading count={0} />} detail={<EmptyState icon={<CheckCircle2 size={22} />} title="You're up to date" />} />
      </>
    );
  }

  return <IncomingSession key={state.incoming.headChangeset} workspacePath={workspacePath} incoming={state.incoming} header={headerSaying} />;
}
