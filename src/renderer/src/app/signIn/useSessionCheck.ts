import { useQuery, type QueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { serverToCheck } from '../startup/connectionProblemShown';
import { useCmAvailability, useSetupCheck } from '../startup/useCmAvailability';
import { useWindowServer } from '../workspace/useWorkspace';

/**
 * The check of the window's place's server (`accounts.checkSession`): as the place opens, and every time the window
 * comes forward, where main checks only once the last check is stale, or while the server needs a sign-in
 * (docs/features/accounts.md "Keeping sessions alive"). Answers the server out of reach, or null; a sign-in the server
 * needs shows through `useServerSessions`. None on the home screen, or before `cm` is known to be configured.
 */
export function useWindowSessionCheck() {
  const cm = useCmAvailability();
  const setup = useSetupCheck(cm.isSuccess);
  const server = serverToCheck(setup.data, useWindowServer());
  const check = useQuery({
    queryKey: queryKeys.serverSession(server ?? ''),
    queryFn: () => api.accounts.checkSession(server ?? '', 'whenStale'),
    enabled: server !== undefined,
    staleTime: Infinity,
    // Main decides whether a check runs: a focus within ten minutes of the last costs no command.
    refetchOnWindowFocus: 'always',
  });
  return { server, check };
}

/** "Check again": checks the server at once, whatever main found last, and shows the answer wherever its check shows. */
export function checkSessionNow(client: QueryClient, server: string): Promise<unknown> {
  return client.fetchQuery({ queryKey: queryKeys.serverSession(server), queryFn: () => api.accounts.checkSession(server, 'now'), staleTime: 0 });
}
