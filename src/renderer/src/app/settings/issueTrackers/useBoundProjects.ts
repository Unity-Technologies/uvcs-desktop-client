import { useQuery } from '@tanstack/react-query';
import { api } from '../../../api/client';

/** How long Settings keeps the projects' names and counts: they change slowly, and each read asks every project. */
const PROJECTS_FRESH_MS = 5 * 60_000;

/**
 * The repository's bound projects with their names and counts (`readProjects`), read as Settings shows the tracker
 * and while the sign-in works: keyed by the projects, so adding or removing one reads them again. Never on focus or a
 * timer.
 */
export function useBoundProjects(repository: string, projects: readonly string[], enabled: boolean) {
  return useQuery({
    queryKey: ['trackerProjects', repository, projects.join('\n')],
    queryFn: () => api.issueTrackers.readProjects(repository),
    staleTime: PROJECTS_FRESH_MS,
    refetchOnWindowFocus: false,
    retry: false,
    enabled,
  });
}
