import { useQuery } from '@tanstack/react-query';
import type { WorkspaceInfo } from '@shared/domain/workspace';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';

/** The comment of what the workspace is loaded from. Keyed by the selector, so a switch reads the new one. */
export function useWorkingObjectComment(workspace: WorkspaceInfo | undefined) {
  const selector = workspace?.selector;
  return useQuery({
    queryKey: queryKeys.inWorkspace(workspace?.path ?? '', 'workingObjectComment', selector?.kind, selector?.name),
    queryFn: () => api.workspaces.workingObjectComment(workspace!.path, selector!),
    enabled: workspace !== undefined,
  });
}
