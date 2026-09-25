import { useQuery } from '@tanstack/react-query';
import type { WorkspaceInfo, WorkspaceSelector } from '@shared/domain/workspace';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { SLOW_CHANGING_QUERY } from '../../app/queryClient';
import { fetchBranch } from './useBranches';

/** The comment of what the workspace is loaded from. Keyed by the selector, so a switch reads the new one. */
export function useWorkingObjectComment(workspace: WorkspaceInfo | undefined) {
  const selector = workspace?.selector;
  return useQuery({
    queryKey: queryKeys.inWorkspace(workspace?.path ?? '', 'workingObjectComment', selector?.kind, selector?.name),
    queryFn: () => readComment(workspace!.path, selector!),
    enabled: workspace !== undefined,
    // The top bar always shows it; comments change by edits, which refresh it.
    ...SLOW_CHANGING_QUERY,
  });
}

/** A branch's comment comes with the branch, which the Changes view reads too: one `cm find` for both. */
async function readComment(workspacePath: string, selector: WorkspaceSelector): Promise<string> {
  if (selector.kind !== 'branch') return api.workspaces.workingObjectComment(workspacePath, selector);
  return (await fetchBranch(workspacePath, selector.name))?.comment ?? '';
}
