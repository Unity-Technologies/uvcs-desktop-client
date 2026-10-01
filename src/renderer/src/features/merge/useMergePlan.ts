import { useQuery } from '@tanstack/react-query';
import type { MergeRequest } from '@shared/domain/merge';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { IMMUTABLE_QUERY } from '../../app/queryClient';

export function useMergePlan(workspacePath: string, request: MergeRequest) {
  return useQuery({
    queryKey: mergePlanKey(workspacePath, request),
    queryFn: () => api.merge.preview(workspacePath, request),
    ...MERGE_PLAN_QUERY,
  });
}

export function mergePlanKey(workspacePath: string, request: MergeRequest) {
  return queryKeys.inWorkspace(workspacePath, 'mergePlan', request);
}

/** How the merge page holds its plan. */
export const MERGE_PLAN_QUERY = {
  // A plan the user is working on must not change under their feet; once they leave it, it's gone, so a merge opened
  // again (after new changesets, or with pending changes) is read anew instead of showing what it was minutes ago.
  staleTime: Infinity,
  gcTime: 0,
  refetchOnWindowFocus: false,
  // Nor do refreshes read it again: not the one after running the merge, while the page still shows it (the page then
  // says what happened, or goes back), nor those of other operations meanwhile. "Try again" still does.
  meta: IMMUTABLE_QUERY,
} as const;
