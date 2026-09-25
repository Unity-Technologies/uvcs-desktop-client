import { useQuery } from '@tanstack/react-query';
import type { WorkspaceSummary } from '@shared/domain/workspace';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { useSettings } from '../settings/useSettings';

export function useWorkspaceList() {
  return useQuery({ queryKey: queryKeys.workspaces, queryFn: () => api.workspaces.list() });
}

const MAX_RESOLVED_WORKSPACES = 10;

/**
 * Repository of the recently used workspaces. Each lookup is a `cm` call, so this is limited to
 * the few recent ones and resolved once per session, never for the whole workspace list.
 * The lookups stop when nothing on screen needs them anymore (e.g. leaving the home screen).
 */
export function useRecentWorkspaceRepositories(workspaces: WorkspaceSummary[] | undefined) {
  const { recentWorkspacePaths } = useSettings();
  const known = new Set((workspaces ?? []).map((workspace) => workspace.path));
  const paths = recentWorkspacePaths.filter((path) => known.has(path)).slice(0, MAX_RESOLVED_WORKSPACES);
  return useQuery({
    queryKey: ['workspaceRepositories', paths],
    queryFn: ({ signal }) => {
      const lookupId = crypto.randomUUID();
      signal.addEventListener('abort', () => void api.system.cancelOperation(lookupId));
      return api.workspaces.repositoriesOf(paths, lookupId);
    },
    enabled: paths.length > 0,
    staleTime: Infinity,
  });
}

export function useServers() {
  return useQuery({ queryKey: queryKeys.profiles, queryFn: () => api.repositories.servers(), staleTime: Infinity });
}

export function useRepositories(server: string | null) {
  return useQuery({
    queryKey: queryKeys.repositories(server ?? ''),
    queryFn: () => api.repositories.list(server!),
    enabled: server !== null,
    staleTime: 60_000,
  });
}

/** Which of the given workspaces no longer have their folder on disk. */
export function useMissingWorkspaceFolders(paths: string[]) {
  return useQuery({
    queryKey: ['missingWorkspaceFolders', paths],
    queryFn: async () => new Set(await api.workspaces.missingFolders(paths)),
    enabled: paths.length > 0,
  });
}
