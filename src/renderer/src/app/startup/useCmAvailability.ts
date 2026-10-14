import { queryOptions, useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';

export const cmVersionQuery = queryOptions({ queryKey: queryKeys.cmVersion, queryFn: () => api.system.cmVersion(), staleTime: Infinity });

/** Checks once that the `cm` CLI can be run; everything in the app depends on it. */
export function useCmAvailability() {
  return useQuery(cmVersionQuery);
}

/** Once `cm` runs: whether it's configured (null when it is). A local check: it never waits on a server. */
export function useSetupCheck(cmAvailable: boolean) {
  return useQuery({ queryKey: queryKeys.cmSetup, queryFn: () => api.system.checkSetup(), enabled: cmAvailable, staleTime: Infinity });
}

/** Whether `cm` is signed in to `server` and reaches it (null when it does); asked for the open workspace's server only. */
export function useConnectionCheck(server: string | undefined) {
  return useQuery({
    queryKey: queryKeys.serverConnection(server ?? ''),
    queryFn: () => api.system.checkConnection(server!),
    enabled: server !== undefined,
    staleTime: Infinity,
  });
}
