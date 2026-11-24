import type { KnownBranch } from '@shared/domain/branch';
import { workspacePlace } from '@shared/domain/place';
import type { WorkspaceSelector } from '@shared/domain/workspace';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { keyedByWorkspaceInfo, queryClient, SLOW_CHANGING_QUERY } from '../../app/queryClient';
import { branchQuery } from '../branches/useBranches';

/**
 * Changes left on what the workspace is on now (`selector`), waiting to be restored. Keyed by the selector, so they are
 * looked up again whenever the workspace moves. On a branch, it hands over the branch the top bar reads
 * (`branchOn`): the changes other apps left name it by its id, which then needs no lookup of its own.
 */
export function leftChangesQuery(workspacePath: string, selector: WorkspaceSelector | undefined) {
  return {
    queryKey: queryKeys.inWorkspace(workspacePath, 'leftChanges', selector),
    queryFn: async () => api.leftChanges.find(workspacePath, await branchOn(workspacePath, selector)),
    staleTime: SLOW_CHANGING_QUERY.staleTime,
    meta: keyedByWorkspaceInfo('selector'),
  };
}

/**
 * The branch the workspace is on, as the top bar read it by name (`branchQuery`): taken from the cache however old, or
 * the top bar's read awaited. A name changes branch only when the branch is deleted and one is created with its name;
 * then the worst is a change another app left being offered once the top bar reads the branch again. None off a
 * branch, or when it couldn't be read: the main process then looks the id up itself, only if another app left changes.
 */
async function branchOn(workspacePath: string, selector: WorkspaceSelector | undefined): Promise<KnownBranch | undefined> {
  if (selector?.kind !== 'branch') return undefined;
  const branch = await queryClient.ensureQueryData(branchQuery(workspacePlace(workspacePath), selector.name)).catch(() => null);
  return branch ? { name: branch.name, id: branch.id } : undefined;
}
