import { useQuery } from '@tanstack/react-query';
import type { WorkspaceInfo } from '@shared/domain/workspace';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { SLOW_CHANGING_QUERY } from '../../app/queryClient';
import { branchQuery } from './useBranches';

/**
 * The comment of what the workspace is loaded from, following a switch. A branch's comment comes with the branch,
 * which the Changes view reads too: one `cm find` for both. The top bar always shows it; comments change by edits,
 * which refresh it.
 */
export function useWorkingObjectComment(workspace: WorkspaceInfo | undefined) {
  const selector = workspace?.selector;
  const branchName = selector?.kind === 'branch' ? selector.name : undefined;
  const branchComment = useQuery({
    ...branchQuery(workspace?.path ?? '', branchName ?? ''),
    select: (branch) => branch?.comment ?? '',
    enabled: branchName !== undefined,
    ...SLOW_CHANGING_QUERY,
  });
  const otherComment = useQuery({
    queryKey: queryKeys.inWorkspace(workspace?.path ?? '', 'workingObjectComment', selector?.kind, selector?.name),
    queryFn: () => api.workspaces.workingObjectComment(workspace!.path, selector!),
    enabled: selector !== undefined && branchName === undefined,
    ...SLOW_CHANGING_QUERY,
  });
  return branchName !== undefined ? branchComment : otherComment;
}
