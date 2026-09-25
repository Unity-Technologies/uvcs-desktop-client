import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { useWorkspacePath } from '../../app/workspace/useWorkspace';

const POLL_INTERVAL_MS = 60_000;

/** How many changesets the loaded branch has that the workspace doesn't. Checked every minute and on focus. */
export function useIncomingSummary() {
  const workspacePath = useWorkspacePath();
  return useQuery({
    queryKey: queryKeys.inWorkspace(workspacePath, 'incoming', 'summary'),
    queryFn: () => api.merge.incomingSummary(workspacePath),
    refetchInterval: POLL_INTERVAL_MS,
    refetchOnWindowFocus: true,
  });
}
