import { queryOptions, useQueries, useQuery, type QueryClient } from '@tanstack/react-query';
import type { RepositoryListing, RepositorySummary, UnityProject } from '@shared/domain/repository';
import type { WorkspaceSummary } from '@shared/domain/workspace';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { SLOW_CHANGING_QUERY } from '../queryClient';
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
 * workspace). Re-read as a list shows once five minutes old, since switching a workspace elsewhere changes its branch;
 * marked stale in this window (each window has its own query client), and so read as a list next shows here, when the
 * workspace this window shows moved to another branch, by an operation or a switch the watcher saw
 * (`markWorkspaceHeadsStaleIfMoved`); read at once on the home screen's Refresh. Other windows' lists, and a switch of
 * a workspace no window of this app shows, wait for the five minutes. Never on a window focus, which would run them
 * all again each time the user comes back.
 */
export function workspaceHeadsQuery(paths: string[]) {
  return queryOptions({
    queryKey: queryKeys.workspaceHeads(paths),
    queryFn: () => api.workspaces.heads(paths),
    enabled: paths.length > 0,
    ...WORKSPACE_HEADS_REFRESH,
  });
}

/** When the heads are read again: as a list shows once five minutes old, never on a window focus. */
export const WORKSPACE_HEADS_REFRESH = SLOW_CHANGING_QUERY;

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

/** What a server holds, read once for its repositories and its projects alike (`useRepositories`, `useProjects`). */
function repositoryListingQuery(server: string | null) {
  return queryOptions({
    queryKey: queryKeys.repositories(server ?? ''),
    queryFn: () => api.repositories.list(server!),
    enabled: server !== null,
    staleTime: 60_000,
  });
}

const repositoriesOf = (listing: RepositoryListing): RepositorySummary[] => listing.repositories;
const projectsOf = (listing: RepositoryListing): UnityProject[] => listing.projects;

export function useRepositories(server: string | null) {
  return useQuery({ ...repositoryListingQuery(server), select: repositoriesOf });
}

/** A Unity organization's projects by name, empty ones too; none elsewhere. Read with its repositories. */
export function useProjects(server: string | null) {
  return useQuery({ ...repositoryListingQuery(server), select: projectsOf });
}

/**
 * The projects of the organizations already read, by server: for where projects show with no reason to list an
 * organization (All workspaces' places). Nothing is asked of a server for them.
 */
export function useReadProjects(servers: readonly string[]): ReadonlyMap<string, UnityProject[]> {
  return useQueries({
    queries: servers.map((server) => ({ ...repositoryListingQuery(server), enabled: false, select: projectsOf })),
    combine: (results) => new Map(results.flatMap((result, index) => (result.data ? [[servers[index]!, result.data] as const] : []))),
  });
}

/** The repositories of `server` already read, for a check that reads nothing (a name taken). */
export function listedRepositories(queryClient: QueryClient, server: string): RepositorySummary[] {
  return queryClient.getQueryData<RepositoryListing>(queryKeys.repositories(server))?.repositories ?? [];
}

