import { queryClient } from '../queryClient';
import { settingsQuery } from '../settings/useSettings';
import { serversQuery, workspaceListQuery } from '../workspace/workspaceQueries';
import { cmVersionQuery } from './useCmAvailability';

/**
 * Asks for what the first screen shows (the home screen's workspaces and servers) as the page loads: the components'
 * own queries would ask only after the first paint, about 100 ms later.
 */
export function prefetchStartupQueries(): void {
  void queryClient.prefetchQuery(settingsQuery);
  void queryClient.prefetchQuery(cmVersionQuery);
  void queryClient.prefetchQuery(workspaceListQuery);
  void queryClient.prefetchQuery(serversQuery);
}
