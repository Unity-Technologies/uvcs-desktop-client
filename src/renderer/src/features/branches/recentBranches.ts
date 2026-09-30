import { useQuery } from '@tanstack/react-query';
import type { Branch } from '@shared/domain/branch';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { queryClient } from '../../app/queryClient';
import { fetchBranch } from './useBranches';

/**
 * The GUIDs of the branches the workspace switched to lately, newest first. They live in the app's settings (the
 * official Desktop client's are only imported once, `importLegacySettings`): cheap to read again.
 */
export function useRecentBranchGuids(workspacePath: string, enabled = true): string[] {
  const { data } = useQuery({ queryKey: recentBranchesKey(workspacePath), queryFn: () => api.branches.recent(workspacePath), enabled: enabled && Boolean(workspacePath) });
  return data ?? EMPTY;
}

/** Records a switch to `name` among the recent branches, before switching. */
export async function rememberRecentBranch(workspacePath: string, name: string): Promise<void> {
  try {
    const guid = cachedBranch(workspacePath, name)?.guid ?? (await fetchBranch(workspacePath, name))?.guid;
    if (!guid) return;
    await api.branches.rememberRecent(workspacePath, guid);
    void queryClient.invalidateQueries({ queryKey: recentBranchesKey(workspacePath) });
  } catch (error) {
    console.warn(`Couldn't remember ${name} among the recent branches`, error);
  }
}

/** A branch from any branch list already read, so remembering one costs no `cm find`. */
function cachedBranch(workspacePath: string, name: string): Branch | undefined {
  for (const [, data] of queryClient.getQueriesData<unknown>({ queryKey: queryKeys.inWorkspace(workspacePath, 'branches') })) {
    const found = (Array.isArray(data) ? (data as Branch[]) : data ? [data as Branch] : []).find((branch) => branch.name === name);
    if (found) return found;
  }
  return undefined;
}

function recentBranchesKey(workspacePath: string) {
  return queryKeys.inWorkspace(workspacePath, 'recentBranches');
}

const EMPTY: string[] = [];
