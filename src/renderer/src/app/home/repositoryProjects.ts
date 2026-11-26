import { nameInProject } from '@shared/domain/organizations';
import type { RepositorySummary, UnityProject } from '@shared/domain/repository';
import { parseProjectGuid, type ProjectGuid } from '@shared/domain/stableIds';
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

/**
 * The project the list shows: the one kept (`ServerSettings.homeProject`) while the organization still has it, else
 * none (all projects). It is kept by its GUID, which a rename keeps; a name kept before, or by a link read before the
 * organization's listing, names it until `movedHomeProject` moves it to the GUID.
 */
export function shownProject(kept: string | undefined, projects: readonly UnityProject[]): UnityProject | null {
  if (kept === undefined) return null;
  const guid = parseProjectGuid(kept);
  return projects.find((project) => (guid ? project.guid === guid : project.name === kept)) ?? null;
}

/**
 * What the home screen keeps for the project picked: its GUID, or its name from a `cm` that printed none (it then
 * moves to the GUID once a listing prints one); null for all projects.
 */
export function homeProjectKept(project: Pick<UnityProject, 'name' | 'guid'> | null): string | null {
  return project === null ? null : (project.guid ?? project.name);
}

/**
 * The project's name as a link names it, kept by its GUID when the organization's listing is already read and holds
 * it, else by the name, which `movedHomeProject` moves to the GUID once the listing is read. Null for all projects.
 */
export function homeProjectOfLink(name: string | null, listed: readonly UnityProject[] | undefined): string | null {
  if (name === null) return null;
  const project = listed?.find((candidate) => candidate.name === name);
  return project ? homeProjectKept(project) : name;
}

/** The GUID a project kept by name moves to, once the listing holds a project by that name with a GUID; else undefined. */
export function movedHomeProject(kept: string | undefined, projects: readonly UnityProject[]): ProjectGuid | undefined {
  if (kept === undefined || parseProjectGuid(kept)) return undefined;
  const project = projects.find((candidate) => candidate.name === kept);
  return project?.guid;
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
