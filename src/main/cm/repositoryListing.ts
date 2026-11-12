// `cm repository list` of a server. A Unity organization's projects are repositories of a type of their own, which the
// command leaves out unless asked with `--type=all`, and `{reptype}` tells them apart (`Project`, `VCS`, and storage
// types the app has no use for). Neither is in `cm`'s help: `cm` keeps `--type` for its own use and testing, so the app
// leans on an option `cm` doesn't promise, and a `cm` that refuses it, or its `all`, is asked again without it
// (`refusesTypeOption`): the list then shows no projects. Projects come in the same call as the repositories: no
// command of their own.
//
// To a server's administrators the list also holds the deleted repositories the server still keeps, which
// `cm repository undelete` can restore: `cm` prints each under its name with `DELETED_PREFIX` before it
// (`__DELETED__Racing/Game`). They come apart from the live ones (`deletedRepositories`), under the name they had, and
// their spec names them by GUID, which `cm repository undelete` takes and, unlike a name, no two share.

import type { RepositoryListing, RepositorySummary, UnityProject } from '@shared/domain/repository';
import { projectOfRepository } from '@shared/domain/organizations';
import { recordFormat } from './formatRecords';

const REPOSITORY_FIELDS = ['repid', 'repname', 'repserver', 'repowner', 'reptype', 'repguid'] as const;

/** A repository of files, as `{reptype}` prints it; printed empty by a `cm` that doesn't know the field. */
const REPOSITORY_TYPES = new Set(['VCS', '']);
const PROJECT_TYPE = 'Project';
/** What `cm repository list` prints before a deleted repository's name. */
const DELETED_PREFIX = '__DELETED__';

/**
 * The command listing the server's repositories, and with `withProjects` its projects too. Each comes with its type and
 * GUID: a project's GUID gives its icon its color (`projectColor`), and a deleted repository is restored by its GUID,
 * since several deleted ones may share a name.
 */
export function repositoryListArgs(server: string, { withProjects }: { withProjects: boolean }): string[] {
  return ['repository', 'list', server, ...(withProjects ? ['--type=all'] : []), `--format=${recordFormat(REPOSITORY_FIELDS)}`];
}

/**
 * The repositories and projects of the records `repositoryListArgs` printed (`readFields`), each by name; a repository
 * knows its project.
 */
export function repositoryListingOf(records: readonly string[][], server: string, { withProjects }: { withProjects: boolean }): RepositoryListing {
  const repositories: RepositorySummary[] = [];
  const deletedRepositories: RepositorySummary[] = [];
  const projects: UnityProject[] = [];
  for (const [id = '', listedName = '', repositoryServer = server, owner = '', type = '', guid = ''] of records) {
    const deleted = listedName.startsWith(DELETED_PREFIX);
    const name = deleted ? listedName.slice(DELETED_PREFIX.length) : listedName;
    const spec = `${deleted && guid ? guid : listedName}@${repositoryServer}`;
    // A deleted project's repositories are listed deleted on their own; the project itself has nothing to show.
    if (withProjects && type === PROJECT_TYPE) {
      if (!deleted) projects.push({ name, guid });
    } else if (!withProjects || REPOSITORY_TYPES.has(type)) {
      if (deleted) deletedRepositories.push({ id, name, server: repositoryServer, owner, spec, deleted: true });
      else repositories.push({ id, name, server: repositoryServer, owner, spec });
    }
  }
  projects.sort((a, b) => byName(a.name, b.name));
  const projectNames = new Set(projects.map((project) => project.name));
  return { repositories: withProjectsOf(byNames(repositories), projectNames), projects, deletedRepositories: withProjectsOf(byNames(deletedRepositories), projectNames) };
}

function byNames(repositories: RepositorySummary[]): RepositorySummary[] {
  return repositories.sort((a, b) => byName(a.name, b.name));
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
