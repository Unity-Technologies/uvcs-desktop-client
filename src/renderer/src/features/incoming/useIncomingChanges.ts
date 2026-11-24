import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useWorkspacePath } from '../../app/workspace/useWorkspace';
import { checksLocalCollisions, incomingChangesFor, incomingChangesQuery, localChangesForUpdateQuery, withLocalCollisions } from './incomingChangesRead';
import { useIncomingSummary } from './useIncomingSummary';

/**
 * The incoming changesets, the files they change and which of them collide with local changes. It diffs the loaded
 * changeset against the head the incoming check saw, once per head (`incomingChangesFor`, `incomingChangesQuery`), so
 * pass `enabled: false` while nothing is incoming. What collides locally follows the local changes, a local read
 * (`withLocalCollisions`).
 */
export function useIncomingChanges({ enabled = true }: { enabled?: boolean } = {}) {
  const workspacePath = useWorkspacePath();
  const { data: summary, isError: checkFailed } = useIncomingSummary();
  const readFor = incomingChangesFor(summary, checkFailed);
  const incoming = useQuery({
    ...incomingChangesQuery(workspacePath, readFor ?? 'unchecked'),
    enabled: enabled && readFor !== undefined,
    placeholderData: (previous) => previous,
  });
  const local = useQuery({ ...localChangesForUpdateQuery(workspacePath), enabled: enabled && checksLocalCollisions(incoming.data) });
  const data = useMemo(
    () =>
      withLocalCollisions(
        incoming.data && { data: incoming.data, readAt: incoming.dataUpdatedAt },
        local.data && { data: local.data, readAt: local.dataUpdatedAt },
      ),
    [incoming.data, incoming.dataUpdatedAt, local.data, local.dataUpdatedAt],
  );
  return { data, isPending: incoming.isPending, isFetching: incoming.isFetching, isError: incoming.isError, error: incoming.error };
}
