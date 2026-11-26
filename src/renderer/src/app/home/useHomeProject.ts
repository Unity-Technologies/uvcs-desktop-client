import { useEffect } from 'react';
import type { UnityProject } from '@shared/domain/repository';
import { updateServerSettings, useServerSettings } from '../settings/useScopedSettings';
import { homeProjectKept, movedHomeProject, shownProject } from './repositoryProjects';

/**
 * The project an organization's repositories are narrowed to (`ServerSettings.homeProject`), and how to pick another.
 * A project kept by name (before projects were kept by GUID, or by a link read before the listing) moves to its GUID
 * once the listing holds it, so renaming the project keeps it picked.
 */
export function useHomeProject(server: string, projects: readonly UnityProject[]): { shown: UnityProject | null; pick: (project: UnityProject | null) => void } {
  const kept = useServerSettings(server).homeProject;
  const moved = movedHomeProject(kept, projects);
  useEffect(() => {
    if (moved) void updateServerSettings(server, { homeProject: moved });
  }, [server, moved]);
  return {
    shown: shownProject(kept, projects),
    pick: (project) => void updateServerSettings(server, { homeProject: homeProjectKept(project) }),
  };
}
