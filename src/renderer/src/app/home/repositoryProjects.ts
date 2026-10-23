import { nameInProject } from '@shared/domain/organizations';
import type { RepositorySummary, UnityProject } from '@shared/domain/repository';
import { matchesWordFilter } from '../../lib/matchesAllWords';

/** The projects whose name holds every word of `search`, in their order. */
export function matchingProjects(projects: readonly UnityProject[], search: string): UnityProject[] {
  return projects.filter((project) => matchesWordFilter([project.name], search));
}

/** The project the list shows: the one picked while the organization still has it, else none (all projects). */
export function shownProject(picked: string | undefined, projects: readonly UnityProject[]): UnityProject | null {
  return (picked !== undefined && projects.find((project) => project.name === picked)) || null;
}

/** The repositories of `project`, or all of them for none. */
export function repositoriesInProject(repositories: readonly RepositorySummary[], project: string | null): RepositorySummary[] {
  return project === null ? [...repositories] : repositories.filter((repository) => repository.project === project);
}

/**
 * How a repository's row names it: by its own name inside the project the list shows, its project before it otherwise
 * (`Racing` / `Game`), so all projects' repositories read apart.
 */
export function repositoryTitle(repository: RepositorySummary, shown: string | null): { project?: string; name: string } {
  const name = nameInProject(repository.name, repository.project);
  return repository.project && repository.project !== shown ? { project: repository.project, name } : { name };
}

/** What the list says when it shows no repository: none matching the text, none in the project picked, or none yet. */
export function noRepositoriesState(filter: string, project: string | null): { title: string; description?: string } {
  if (filter.trim()) return { title: 'No matching repositories' };
  if (project !== null) return { title: `No repositories in ${project} yet`, description: 'Create one to start versioning a project.' };
  return { title: 'No repositories yet', description: 'Create one to start versioning a project.' };
}
