import { useQuery } from '@tanstack/react-query';
import type { MergeRequest } from '@shared/domain/merge';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';

/** Merging a task branch to another branch on the server, e.g. `br:/main/t1` to `/main`. */
export function mergeTaskRequest(sourceSpec: string, destinationBranch: string): MergeRequest {
  return { kind: 'merge', sourceSpec, destinationBranch };
}

/** What merging the task would do. Asks the server only while the dialog is open: once when it opens, and when asked to. */
export function useMergeTaskPreview(workspacePath: string, request: MergeRequest) {
  return useQuery({
    queryKey: queryKeys.inWorkspace(workspacePath, 'mergeTaskPreview', request),
    queryFn: () => api.merge.preview(workspacePath, request),
    refetchOnWindowFocus: false,
  });
}
