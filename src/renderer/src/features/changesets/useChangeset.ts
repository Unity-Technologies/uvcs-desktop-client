import { useQuery } from '@tanstack/react-query';
import type { Changeset } from '@shared/domain/changeset';
import { otherRepository } from '@shared/domain/repository';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { queryClient } from '../../app/queryClient';
import { useWorkspaceInfo, useWorkspacePath } from '../../app/workspace/useWorkspace';

/**
 * `repository` is the one the changeset is in, when it may not be the workspace's (an item's, under an xlink): it is
 * read there then, and only once the workspace's repository is known, which tells the two apart.
 */
export function useChangeset(changesetId: number | null, repository?: string) {
  const workspacePath = useWorkspacePath();
  const workspaceRepository = useWorkspaceInfo().data?.repository;
  const known = !repository || workspaceRepository !== undefined;
  const other = otherRepository(repository, workspaceRepository);
  // The workspace's lists hold its own repository's changesets only.
  const listed = () => (known && !other ? listedChangeset(workspacePath, changesetId) : undefined);
  return useQuery({
    queryKey: queryKeys.inWorkspace(workspacePath, 'changesets', 'byId', changesetId, other),
    queryFn: () => api.changesets.get(workspacePath, changesetId!, other),
    enabled: changesetId !== null && known,
    // Opened from a list already read (Changesets, the palette): shown at once, asked for only once that list is stale.
    initialData: () => listed()?.changeset,
    initialDataUpdatedAt: () => listed()?.readAt,
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
