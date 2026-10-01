import { queryOptions } from '@tanstack/react-query';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';

/** The running app's version and what it runs on: it never changes while the app runs. */
export const appInfoQuery = queryOptions({ queryKey: queryKeys.appInfo, queryFn: () => api.updates.appInfo(), staleTime: Infinity });
