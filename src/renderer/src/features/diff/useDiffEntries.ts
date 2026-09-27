import { useQuery } from '@tanstack/react-query';
import type { DiffTarget } from '@shared/domain/diff';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { IMMUTABLE_QUERY } from '../../app/queryClient';
import { useWorkspacePath } from '../../app/workspace/useWorkspace';

interface DiffEntriesOptions {
  /** False reads only what is already cached: `cm diff` is too heavy to run on every selection. */
  enabled?: boolean;
  /** The branch head the diff is read at, so a branch diff is reused until the branch moves. */
  branchHead?: number;
}

export function useDiffEntries(target: DiffTarget | null, { enabled = true, branchHead }: DiffEntriesOptions = {}) {
  const workspacePath = useWorkspacePath();
  // History does not change once written, nor does a shelve or a branch at a given head; other diffs refresh with the workspace.
  const immutable = target?.kind === 'changeset' || target?.kind === 'range' || target?.kind === 'shelve' || branchHead !== undefined;
  return useQuery({
    queryKey: branchHead === undefined ? queryKeys.inWorkspace(workspacePath, 'diff', target) : queryKeys.inWorkspace(workspacePath, 'diff', target, branchHead),
    queryFn: () => api.diff.entries(workspacePath, target!),
    enabled: enabled && target !== null,
    staleTime: immutable ? Infinity : 15_000,
    // Kept (the last objects opened, `MAX_UNUSED_IMMUTABLE`): coming back to one shows its files without asking the server again.
    gcTime: immutable ? Infinity : undefined,
    meta: immutable ? IMMUTABLE_QUERY : undefined,
  });
}
