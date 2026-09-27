import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import type { PendingChange } from '@shared/domain/pendingChanges';
import { api } from '../../../api/client';
import { queryKeys } from '../../../api/queryKeys';
import { queryClient } from '../../../app/queryClient';
import { locksPendingChanges, pendingLocks, type PendingLocks } from './pendingLocks';

/** Locks change on the server, where nothing tells us: re-read them with the pending changes, at most this often. */
const LOCKS_STALE_MS = 30_000;

/**
 * The locks on the pending changes: my exclusive checkouts in this workspace, and the ones others hold. Read only
 * while there are changes, and refreshed along with them once the last read is older than 30 seconds. Which locks are
 * mine is asked only when some lock holds a pending change.
 */
export function usePendingLocks(workspacePath: string, repository: string | undefined, changes: PendingChange[], changesUpdatedAt: number): PendingLocks {
  const enabled = Boolean(repository) && changes.length > 0;
  const key = queryKeys.inWorkspace(workspacePath, 'locks', repository, 'pending');
  const query = (scope: 'mine' | 'all', onlyMine: boolean, scopeEnabled: boolean) => ({
    queryKey: [...key, scope],
    queryFn: () => api.locks.list(workspacePath, repository!, { onlyMine, onlyThisWorkspace: onlyMine }),
    enabled: scopeEnabled,
    staleTime: LOCKS_STALE_MS,
    placeholderData: keepPreviousData,
  });
  const { data: all } = useQuery(query('all', false, enabled));
  const anyLocked = useMemo(() => all !== undefined && locksPendingChanges(changes, all), [changes, all]);
  const needsMine = enabled && anyLocked;
  const { data: mine } = useQuery(query('mine', true, needsMine));

  useEffect(() => {
    // A read already running (an operation's refresh) is recent enough: don't start it again.
    if (enabled) void queryClient.refetchQueries({ queryKey: key, stale: true, type: 'active' }, { cancelRefetch: false });
  }, [changesUpdatedAt]);

  return useMemo(() => {
    // Until it is known which locks are mine, mine would pass for someone else's.
    if (needsMine && mine === undefined) return NO_LOCKS;
    return pendingLocks(changes, mine ?? [], all ?? []);
  }, [changes, mine, all, needsMine]);
}

const NO_LOCKS: PendingLocks = new Map();
