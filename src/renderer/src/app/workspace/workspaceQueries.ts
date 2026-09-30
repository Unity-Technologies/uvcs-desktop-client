import { queryOptions, useQuery } from '@tanstack/react-query';
import type { WorkspaceSummary } from '@shared/domain/workspace';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { useSettings } from '../settings/useSettings';

export const workspaceListQuery = queryOptions({ queryKey: queryKeys.workspaces, queryFn: () => api.workspaces.list() });

export function useWorkspaceList() {
  return useQuery(workspaceListQuery);
}

const MAX_RESOLVED_WORKSPACES = 10;

/**
 * Repository of the recently used workspaces. Each lookup is a `cm` call, so this is limited to
 * the few recent ones and resolved once per session, never for the whole workspace list.
 * The lookups stop when nothing on screen needs them anymore (e.g. leaving the home screen).
 * Paths in `alreadyKnown` (e.g. told by their `.plastic` folder) are skipped.
 */
export function useRecentWorkspaceRepositories(workspaces: WorkspaceSummary[] | undefined, alreadyKnown: Record<string, unknown> = {}) {
  const { recentWorkspacePaths } = useSettings();
  const listed = new Set((workspaces ?? []).map((workspace) => workspace.path));
  const paths = recentWorkspacePaths.filter((path) => listed.has(path) && !(path in alreadyKnown)).slice(0, MAX_RESOLVED_WORKSPACES);
  return useQuery({
    queryKey: queryKeys.workspaceRepositories(paths),
    queryFn: ({ signal }) => {
      const lookupId = crypto.randomUUID();
      signal.addEventListener('abort', () => void api.system.cancelOperation(lookupId));
      return api.workspaces.repositoriesOf(paths, lookupId);
    },
    enabled: paths.length > 0,
    staleTime: Infinity,
  });
}

/**
 * Repository and branch of every listed workspace, read from their `.plastic` folders (no `cm` call). Re-read whenever
 * the list shows again, since switching a workspace elsewhere changes its branch.
 */
export function useWorkspaceHeads(workspaces: WorkspaceSummary[] | undefined) {
  const paths = (workspaces ?? []).map((workspace) => workspace.path);
  return useQuery({
    queryKey: queryKeys.workspaceHeads(paths),
    queryFn: () => api.workspaces.heads(paths),
    enabled: paths.length > 0,
  });
}

/** Which of these recent paths (ones `cm` doesn't list) lost their folder. */
export function useMissingWorkspacePaths(paths: string[]) {
  return useQuery({
    queryKey: queryKeys.missingWorkspacePaths(paths),
    queryFn: () => api.workspaces.findMissing(paths),
    enabled: paths.length > 0,
  });
}

export const serversQuery = queryOptions({ queryKey: queryKeys.profiles, queryFn: () => api.repositories.servers(), staleTime: Infinity });

export function useServers() {
  return useQuery(serversQuery);
}

export function useRepositories(server: string | null) {
  return useQuery({
    queryKey: queryKeys.repositories(server ?? ''),
    queryFn: () => api.repositories.list(server!),
    enabled: server !== null,
    staleTime: 60_000,
  });
}

