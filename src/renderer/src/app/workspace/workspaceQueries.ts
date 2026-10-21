import { queryOptions, useQueries, useQuery } from '@tanstack/react-query';
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
 * The repository of one recently used workspace, null when `cm` can't tell. One query per workspace, kept for the
 * session: a workspace becoming recent costs one lookup, never the others' again (main runs them two at a time). The
 * lookup stops when nothing on screen needs it anymore (e.g. leaving the home screen).
 */
export function workspaceRepositoryQuery(path: string) {
  return queryOptions({
    queryKey: queryKeys.workspaceRepository(path),
    queryFn: async ({ signal }) => {
      const lookupId = crypto.randomUUID();
      signal.addEventListener('abort', () => void api.system.cancelOperation(lookupId));
      return api.workspaces.repositoryOf(path, lookupId);
    },
    staleTime: Infinity,
    // Kept off screen too: at most `MAX_RESOLVED_WORKSPACES` small answers, keyed by path.
    gcTime: Infinity,
  });
}

/**
 * Repository of the recently used workspaces. Each lookup is a `cm` call, so this is limited to the few recent ones
 * and resolved once per session (`workspaceRepositoryQuery`), never for the whole workspace list. Paths in
 * `alreadyKnown` (e.g. told by `cm wi`, `useWorkspaceHeads`) are skipped.
 */
export function useRecentWorkspaceRepositories(workspaces: WorkspaceSummary[] | undefined, alreadyKnown: Record<string, unknown> = {}) {
  const { recentWorkspacePaths } = useSettings();
  const listed = new Set((workspaces ?? []).map((workspace) => workspace.path));
  const paths = recentWorkspacePaths.filter((path) => listed.has(path) && !(path in alreadyKnown)).slice(0, MAX_RESOLVED_WORKSPACES);
  return useQueries({
    queries: paths.map(workspaceRepositoryQuery),
    combine: (results) => ({
      data: Object.fromEntries(results.flatMap((result, index) => (result.data === undefined ? [] : [[paths[index]!, result.data]]))) as Record<string, string | null>,
    }),
  });
}

/**
 * Repository and branch of every listed workspace, from a local `cm wi` of each (no server call, but one command per
 * workspace). Re-read when the list shows again once stale, since switching a workspace elsewhere changes its branch;
 * never on a window focus, which would run them all again each time the user comes back.
 */
export function workspaceHeadsQuery(paths: string[]) {
  return queryOptions({
    queryKey: queryKeys.workspaceHeads(paths),
    queryFn: () => api.workspaces.heads(paths),
    enabled: paths.length > 0,
    refetchOnWindowFocus: false,
  });
}

export function useWorkspaceHeads(workspaces: WorkspaceSummary[] | undefined) {
  return useQuery(workspaceHeadsQuery((workspaces ?? []).map((workspace) => workspace.path)));
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

