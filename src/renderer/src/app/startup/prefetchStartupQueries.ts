import { pendingChangesQuery } from '../../features/pendingChanges/usePendingChanges';
import { queryClient } from '../queryClient';
import { settingsQuery } from '../settings/useSettings';
import { useSession } from '../workspace/sessionStore';
import { workspaceInfoQuery } from '../workspace/useWorkspace';
import { serversQuery, workspaceListQuery } from '../workspace/workspaceQueries';
import { cmVersionQuery } from './useCmAvailability';

/**
 * Asks for what the first screen shows as the page loads: the components' own queries would ask only after the first
 * paint, and by then the main process is busy showing the window (`show()` holds it for 50-100 ms). A window that
 * starts on a workspace (`openWorkspaceFromAddress`, its folder known to be there) asks for what its Changes view
 * shows; the home screen for its workspaces and servers.
 */
export async function prefetchStartupQueries(): Promise<void> {
  const workspacePath = useSession.getState().workspacePath;
  await Promise.all([
    queryClient.prefetchQuery(settingsQuery),
    queryClient.prefetchQuery(cmVersionQuery),
    ...(workspacePath ? [prefetchWorkspaceQueries(workspacePath)] : [queryClient.prefetchQuery(workspaceListQuery), queryClient.prefetchQuery(serversQuery)]),
  ]);
}

async function prefetchWorkspaceQueries(workspacePath: string): Promise<void> {
  const info = queryClient.prefetchQuery(workspaceInfoQuery(workspacePath));
  // The pending changes are read as the user's settings filter them.
  const settings = await queryClient.fetchQuery(settingsQuery).catch(() => null);
  if (settings) await queryClient.prefetchQuery(pendingChangesQuery(workspacePath, settings.pendingChanges));
  await info;
}
