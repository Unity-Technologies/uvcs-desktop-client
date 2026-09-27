import { useQuery } from '@tanstack/react-query';
import type { MergeRequest } from '@shared/domain/merge';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';

export function useMergePlan(workspacePath: string, request: MergeRequest) {
  return useQuery({
    queryKey: queryKeys.inWorkspace(workspacePath, 'mergePlan', request),
    queryFn: () => api.merge.preview(workspacePath, request),
    // A plan the user is working on must not change under their feet; once they leave it, it's gone, so a merge opened
    // again (after new changesets, or with pending changes) is read anew instead of showing what it was minutes ago.
    staleTime: Infinity,
    gcTime: 0,
    refetchOnWindowFocus: false,
  });
}
