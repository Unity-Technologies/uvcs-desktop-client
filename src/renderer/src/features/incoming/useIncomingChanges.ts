import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { useWorkspacePath } from '../../app/workspace/useWorkspace';

export function incomingChangesKey(workspacePath: string): readonly unknown[] {
  return queryKeys.inWorkspace(workspacePath, 'incoming', 'changes');
}

/**
 * The incoming changesets, the files they change and which of them collide with local changes.
 * It diffs the loaded changeset against the head, so pass `enabled: false` while nothing is incoming.
 */
export function useIncomingChanges({ enabled = true }: { enabled?: boolean } = {}) {
  const workspacePath = useWorkspacePath();
  return useQuery({
    queryKey: incomingChangesKey(workspacePath),
    enabled,
    queryFn: () => api.merge.incomingChanges(workspacePath),
    placeholderData: (previous) => previous,
  });
}
