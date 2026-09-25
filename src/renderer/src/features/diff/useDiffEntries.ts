import { useQuery } from '@tanstack/react-query';
import type { DiffTarget } from '@shared/domain/diff';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { useWorkspacePath } from '../../app/workspace/useWorkspace';

export function useDiffEntries(target: DiffTarget | null) {
  const workspacePath = useWorkspacePath();
  return useQuery({
    queryKey: queryKeys.inWorkspace(workspacePath, 'diff', target),
    queryFn: () => api.diff.entries(workspacePath, target!),
    enabled: target !== null,
    // History does not change once written; shelves and branches can, but refresh with the workspace.
    staleTime: target?.kind === 'changeset' || target?.kind === 'range' ? Infinity : 15_000,
  });
}
