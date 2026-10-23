import { nameInProject } from '@shared/domain/organizations';
import type { RepositorySummary, UnityProject } from '@shared/domain/repository';
import { matchesWordFilter } from '../../lib/matchesAllWords';

/** A project to pick in a Unity organization's repositories, with how many of them it holds. */
export interface ProjectChoice extends UnityProject {
  repositoryCount: number;
}

/** Every project of the organization by name (as listed), empty ones too, each with its repositories counted. */
export function projectChoices(projects: readonly UnityProject[], repositories: readonly RepositorySummary[]): ProjectChoice[] {
  const counts = new Map<string, number>();
  for (const { project } of repositories) if (project) counts.set(project, (counts.get(project) ?? 0) + 1);
  return projects.map((project) => ({ ...project, repositoryCount: counts.get(project.name) ?? 0 }));
}

/** The projects whose name holds every word of `search`, in their order. */
export function matchingProjects(choices: readonly ProjectChoice[], search: string): ProjectChoice[] {
  return choices.filter((choice) => matchesWordFilter([choice.name], search));
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
 * How a repository's row names it: by its own name (`Game` for `Racing/Game`), and, across all projects, its project
 * on the quiet line under it (`project`). Inside the project shown, no project.
 */
export function repositoryLabels(repository: RepositorySummary, shown: string | null): { name: string; project?: string } {
  const name = nameInProject(repository.name, repository.project);
  return repository.project && repository.project !== shown ? { name, project: repository.project } : { name };
}

/** What the list says when it shows no repository: none matching the text, none in the project picked, or none yet. */
export function noRepositoriesState(filter: string, project: string | null): { title: string; description?: string } {
  if (filter.trim()) return { title: 'No matching repositories' };
  if (project !== null) return { title: `No repositories in ${project} yet`, description: 'Create one to start versioning a project.' };
  return { title: 'No repositories yet', description: 'Create one to start versioning a project.' };
}
