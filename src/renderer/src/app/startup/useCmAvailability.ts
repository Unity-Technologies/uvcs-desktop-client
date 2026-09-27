import { queryOptions, useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';

export const cmVersionQuery = queryOptions({ queryKey: ['cmVersion'], queryFn: () => api.system.cmVersion(), staleTime: Infinity });

/** Checks once that the `cm` CLI can be run; everything in the app depends on it. */
export function useCmAvailability() {
  return useQuery(cmVersionQuery);
}

/** Once `cm` runs: whether it's configured, signed in and reaches its server (null when it all works). */
export function useSetupCheck(cmAvailable: boolean) {
  return useQuery({ queryKey: ['cmSetup'], queryFn: () => api.system.checkSetup(), enabled: cmAvailable, staleTime: Infinity });
}
