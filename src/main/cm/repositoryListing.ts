// `cm repository list` of a server. A Unity organization's projects are repositories of a type of their own, which the
// command leaves out unless asked with `--type=all`, and `{reptype}` tells them apart (`Project`, `VCS`, and storage
// types the app has no use for). Neither is in `cm`'s help: `cm` keeps `--type` for its own use and testing, so the app
// leans on an option `cm` doesn't promise, and a `cm` that refuses it, or its `all`, is asked again without it
// (`refusesTypeOption`): the list then shows no projects. Projects come in the same call as the repositories: no
// command of their own.

import type { RepositoryListing, RepositorySummary, UnityProject } from '@shared/domain/repository';
import { projectOfRepository } from '@shared/domain/organizations';
import { recordFormat } from './formatRecords';

const REPOSITORY_FIELDS = ['repid', 'repname', 'repserver', 'repowner'] as const;

/** A repository of files, as `{reptype}` prints it; printed empty by a `cm` that doesn't know the field. */
const REPOSITORY_TYPES = new Set(['VCS', '']);
const PROJECT_TYPE = 'Project';

/** The command listing the server's repositories, and with `withProjects` its projects too. */
export function repositoryListArgs(server: string, { withProjects }: { withProjects: boolean }): string[] {
  if (!withProjects) return ['repository', 'list', server, `--format=${recordFormat(REPOSITORY_FIELDS)}`];
  // A project's GUID gives its icon its color (`projectColor`).
  return ['repository', 'list', server, '--type=all', `--format=${recordFormat([...REPOSITORY_FIELDS, 'reptype', 'repguid'])}`];
}

/**
 * The repositories and projects of the records `repositoryListArgs` printed (`readFields`), each by name; a repository
 * knows its project.
 */
export function repositoryListingOf(records: readonly string[][], server: string, { withProjects }: { withProjects: boolean }): RepositoryListing {
  const repositories: RepositorySummary[] = [];
  const projects: UnityProject[] = [];
  for (const [id = '', name = '', repositoryServer = server, owner = '', type = '', guid = ''] of records) {
    if (withProjects && type === PROJECT_TYPE) projects.push({ name, guid });
    else if (!withProjects || REPOSITORY_TYPES.has(type)) repositories.push({ id, name, server: repositoryServer, owner, spec: `${name}@${repositoryServer}` });
  }
  projects.sort((a, b) => byName(a.name, b.name));
  repositories.sort((a, b) => byName(a.name, b.name));
  return { repositories: withProjectsOf(repositories, new Set(projects.map((project) => project.name))), projects };
}

function withProjectsOf(repositories: RepositorySummary[], projects: ReadonlySet<string>): RepositorySummary[] {
  if (projects.size === 0) return repositories;
  return repositories.map((repository) => {
    const project = projectOfRepository(repository.name, projects);
    return project ? { ...repository, project } : repository;
  });
}

function byName(a: string, b: string): number {
  return a.localeCompare(b);
}

/**
 * Whether `cm` failed the listing for not taking `--type`, whose refusal names the option in any language, or for not
 * knowing its value `all`, which a `cm` reading the type by name refuses quoting it.
 */
export function refusesTypeOption(message: string): boolean {
  return message.includes('--type') || message.includes("'all'");
}
