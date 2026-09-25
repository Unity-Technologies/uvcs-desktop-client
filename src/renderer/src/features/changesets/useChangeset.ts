import { useQuery } from '@tanstack/react-query';
import type { Changeset } from '@shared/domain/changeset';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { queryClient } from '../../app/queryClient';
import { useWorkspacePath } from '../../app/workspace/useWorkspace';

export function useChangeset(changesetId: number | null) {
  const workspacePath = useWorkspacePath();
  return useQuery({
    queryKey: queryKeys.inWorkspace(workspacePath, 'changesets', 'byId', changesetId),
    queryFn: () => api.changesets.get(workspacePath, changesetId!),
    enabled: changesetId !== null,
    // Opened from a list already read (Changesets, the palette): shown at once, asked for only once that list is stale.
    initialData: () => listedChangeset(workspacePath, changesetId)?.changeset,
    initialDataUpdatedAt: () => listedChangeset(workspacePath, changesetId)?.readAt,
  });
}

function listedChangeset(workspacePath: string, changesetId: number | null): { changeset: Changeset; readAt: number } | undefined {
  if (changesetId === null) return undefined;
  for (const query of queryClient.getQueryCache().findAll({ queryKey: queryKeys.inWorkspace(workspacePath, 'changesets') })) {
    const changeset = Array.isArray(query.state.data) ? (query.state.data as Changeset[]).find((listed) => listed.id === changesetId) : undefined;
    if (changeset) return { changeset, readAt: query.state.dataUpdatedAt };
  }
  return undefined;
}
