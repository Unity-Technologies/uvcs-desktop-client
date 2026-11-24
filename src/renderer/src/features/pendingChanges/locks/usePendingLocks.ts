import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import { workspacePlace } from '@shared/domain/place';
import type { PendingChange } from '@shared/domain/pendingChanges';
import { queryClient } from '../../../app/queryClient';
import { locksQuery } from '../../locks/locksQuery';
import { locksPendingChanges, pendingLocks, type PendingLocks } from './pendingLocks';

/**
 * The locks on the pending changes: my exclusive checkouts in this workspace, and the ones others hold. Read only
 * while there are changes, and refreshed along with them once the last read is older than 30 seconds. Every lock is
 * the Locks view's own query (`locksQuery`), read once for both. Which locks are mine here is asked only when some lock
 * holds a pending change.
 */
export function usePendingLocks(workspacePath: string, repository: string | undefined, changes: PendingChange[], changesUpdatedAt: number): PendingLocks {
  const enabled = Boolean(repository) && changes.length > 0;
  const place = workspacePlace(workspacePath);
  const everyLock = locksQuery(place, repository, 'everyone');
  const mineHere = locksQuery(place, repository, 'mineInThisWorkspace');
  const { data: all } = useQuery({ ...everyLock, enabled });
  const anyLocked = useMemo(() => all !== undefined && locksPendingChanges(changes, all), [changes, all]);
  const needsMine = enabled && anyLocked;
  const { data: mine } = useQuery({ ...mineHere, enabled: needsMine });

  useEffect(() => {
    // A read already running (an operation's refresh) is recent enough: don't start it again.
    if (!enabled) return;
    for (const { queryKey } of [everyLock, mineHere]) void queryClient.refetchQueries({ queryKey, exact: true, stale: true, type: 'active' }, { cancelRefetch: false });
  }, [changesUpdatedAt]);

  return useMemo(() => {
    // Until it is known which locks are mine, mine would pass for someone else's.
    if (needsMine && mine === undefined) return NO_LOCKS;
    return pendingLocks(changes, mine ?? [], all ?? []);
  }, [changes, mine, all, needsMine]);
}

const NO_LOCKS: PendingLocks = new Map();
