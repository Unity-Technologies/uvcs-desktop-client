import { useQuery } from '@tanstack/react-query';
import type { TrackerConnection } from '@shared/domain/issueTrackers';
import { api } from '../../../api/client';

/** How long Settings keeps the projects' names and counts: they change slowly, and each read asks every project. */
const PROJECTS_FRESH_MS = 5 * 60_000;

/**
 * The repository's bound projects with their names and counts (`readProjects`), read as Settings shows the tracker
 * and while the sign-in works: keyed by the connection, its credential's state and the projects, so another tracker,
 * a sign-in renewed, or a project added or removed, reads them again. Never on focus or a timer.
 */
export function useBoundProjects(repository: string, connection: Pick<TrackerConnection, 'id' | 'credential'>, projects: readonly string[], enabled: boolean) {
  return useQuery({
    queryKey: ['trackerProjects', repository, connection.id, connection.credential, projects.join('\n')],
    queryFn: () => api.issueTrackers.readProjects(repository),
    staleTime: PROJECTS_FRESH_MS,
    refetchOnWindowFocus: false,
    retry: false,
    enabled,
  });
}
