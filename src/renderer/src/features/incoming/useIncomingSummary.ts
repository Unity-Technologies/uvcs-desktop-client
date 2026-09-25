import { useQuery } from '@tanstack/react-query';
import type { IncomingSummary } from '@shared/domain/incoming';
import { api } from '../../api/client';
import { queryKeys, workspaceKey } from '../../api/queryKeys';
import { queryClient } from '../../app/queryClient';
import { branchHeadMovedOnServer } from '../../app/refresh/headChanges';
import { refreshQueries } from '../../app/refresh/refreshQueries';
import { isAffectedByNewChangesets } from '../../app/refresh/refreshScopes';
import { useWorkspacePath } from '../../app/workspace/useWorkspace';
import { incomingPollInterval } from './incomingPollInterval';

/** Coming back to the window checks again if the last check is older than this. */
const RECHECK_ON_FOCUS_AFTER_MS = 20_000;

/**
 * How many changesets the loaded branch has that the workspace doesn't. Incoming changes happen on the server, so
 * this is polled (every minute while the window has focus, every five behind other apps, never while hidden) and
 * checked again on focus. When someone else checks in to the branch, the repository views refresh too.
 */
export function useIncomingSummary() {
  const workspacePath = useWorkspacePath();
  return useQuery({
    queryKey: queryKeys.inWorkspace(workspacePath, 'incoming', 'summary'),
    queryFn: ({ queryKey }) => checkIncoming(workspacePath, queryKey),
    staleTime: RECHECK_ON_FOCUS_AFTER_MS,
    refetchOnWindowFocus: true,
    refetchInterval: () => incomingPollInterval(document.visibilityState === 'visible', document.hasFocus()),
    refetchIntervalInBackground: true,
  });
}

async function checkIncoming(workspacePath: string, queryKey: readonly unknown[]): Promise<IncomingSummary> {
  const before = queryClient.getQueryData<IncomingSummary>(queryKey);
  const after = await api.merge.incomingSummary(workspacePath);
  if (before && branchHeadMovedOnServer(before, after)) {
    void refreshQueries({ queryKey: workspaceKey(workspacePath), predicate: (query) => isAffectedByNewChangesets(query.queryKey) });
  }
  return after;
}
