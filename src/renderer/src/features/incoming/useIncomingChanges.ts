import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useWorkspacePath } from '../../app/workspace/useWorkspace';
import { useReadPendingChanges } from '../pendingChanges/usePendingChanges';
import { incomingChangesFor, incomingChangesQuery, withLocalCollisions } from './incomingChangesRead';
import { useIncomingSummary } from './useIncomingSummary';

/**
 * The incoming changesets, the files they change and which of them collide with local changes. It diffs the loaded
 * changeset against the head the incoming check saw, once per head (`incomingChangesFor`, `incomingChangesQuery`), so
 * pass `enabled: false` while nothing is incoming. What collides locally follows Changes' pending changes as they are
 * read, never reading them itself (`useReadPendingChanges`, `withLocalCollisions`).
 */
export function useIncomingChanges({ enabled = true }: { enabled?: boolean } = {}) {
  const workspacePath = useWorkspacePath();
  const { data: summary, isError: checkFailed } = useIncomingSummary();
  const readFor = incomingChangesFor(summary, checkFailed);
  const incoming = useQuery({
    ...incomingChangesQuery(workspacePath, readFor),
    enabled: enabled && readFor !== undefined,
    placeholderData: (previous) => previous,
  });
  const pending = useReadPendingChanges(workspacePath);
  const data = useMemo(
    () =>
      withLocalCollisions(
        incoming.data && { data: incoming.data, readAt: incoming.dataUpdatedAt },
        pending.data && { data: pending.data, readAt: pending.dataUpdatedAt },
      ),
    [incoming.data, incoming.dataUpdatedAt, pending.data, pending.dataUpdatedAt],
  );
  return { data, isPending: incoming.isPending, isFetching: incoming.isFetching, isError: incoming.isError, error: incoming.error };
}
