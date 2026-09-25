import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import type { PendingChange } from '@shared/domain/pendingChanges';
import { api } from '../../../api/client';
import { queryKeys } from '../../../api/queryKeys';
import { queryClient } from '../../../app/queryClient';
import { pendingLocks, type PendingLocks } from './pendingLocks';

/** Locks change on the server, where nothing tells us: re-read them with the pending changes, at most this often. */
const LOCKS_STALE_MS = 30_000;

/**
 * The locks on the pending changes: my exclusive checkouts in this workspace, and the ones others hold. Read only
 * while there are changes, and refreshed along with them once the last read is older than 30 seconds.
 */
export function usePendingLocks(workspacePath: string, repository: string | undefined, changes: PendingChange[], changesUpdatedAt: number): PendingLocks {
  const enabled = Boolean(repository) && changes.length > 0;
  const key = queryKeys.inWorkspace(workspacePath, 'locks', repository, 'pending');
  const query = (scope: 'mine' | 'all', onlyMine: boolean) => ({
    queryKey: [...key, scope],
    queryFn: () => api.locks.list(workspacePath, repository!, { onlyMine, onlyThisWorkspace: onlyMine }),
    enabled,
    staleTime: LOCKS_STALE_MS,
    placeholderData: keepPreviousData,
  });
  const { data: mine } = useQuery(query('mine', true));
  const { data: all } = useQuery(query('all', false));

  useEffect(() => {
    if (enabled) void queryClient.refetchQueries({ queryKey: key, stale: true, type: 'active' });
  }, [changesUpdatedAt]);

  return useMemo(() => pendingLocks(changes, mine ?? [], all ?? []), [changes, mine, all]);
}
