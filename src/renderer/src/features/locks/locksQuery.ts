import { keepPreviousData } from '@tanstack/react-query';
import type { Place } from '@shared/domain/place';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';

/**
 * Whose locks are read: everyone's, the user's, or the user's in this workspace only. The last can't be picked out of
 * the others: `cm lock list --onlycurrentworkspace` tells the workspace by its guid, and a lock's record names only
 * the workspace's name.
 */
export type LocksScope = 'everyone' | 'mine' | 'mineInThisWorkspace';

/** Locks change on the server, where nothing tells us: re-read them as they show, at most this often. */
const LOCKS_STALE_MS = 30_000;

/**
 * The repository's locks in `scope`. One query per scope wherever they show: the Locks view and the lock marks of the
 * pending changes (`usePendingLocks`) both read everyone's locks with the same `cm lock list`, so they share it.
 */
export function locksQuery(place: Place, repository: string | undefined, scope: LocksScope) {
  return {
    queryKey: queryKeys.inPlace(place, 'locks', repository, scope),
    queryFn: () => api.locks.list(place, repository!, { onlyMine: scope !== 'everyone', onlyThisWorkspace: scope === 'mineInThisWorkspace' }),
    staleTime: LOCKS_STALE_MS,
    placeholderData: keepPreviousData,
  };
}
