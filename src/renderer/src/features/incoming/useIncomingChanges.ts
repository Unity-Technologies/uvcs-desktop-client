import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { useWorkspacePath } from '../../app/workspace/useWorkspace';

/** The incoming changesets, the files they change and which of them collide with local changes. */
export function useIncomingChanges() {
  const workspacePath = useWorkspacePath();
  return useQuery({
    queryKey: queryKeys.inWorkspace(workspacePath, 'incoming', 'changes'),
    queryFn: () => api.merge.incomingChanges(workspacePath),
    placeholderData: (previous) => previous,
  });
}
