// `cm repository list` of a server. A Unity organization's projects are repositories of a type of their own, which the
// command leaves out unless asked with `--type=all`, and `{reptype}` tells them apart (`Project`, `VCS`, and storage
// types the app has no use for). Neither is in `cm`'s help, so a `cm` that doesn't take `--type` is asked again
// without it (`refusesTypeOption`). Projects come in the same call as the repositories: no command of their own.

import type { RepositoryListing, RepositorySummary } from '@shared/domain/repository';
import { projectOfRepository } from '@shared/domain/organizations';
import { parseRecords, recordFormat } from './formatRecords';

const REPOSITORY_FIELDS = ['repid', 'repname', 'repserver', 'repowner'] as const;

/** A repository of files, as `{reptype}` prints it; printed empty by a `cm` that doesn't know the field. */
const REPOSITORY_TYPES = new Set(['VCS', '']);
const PROJECT_TYPE = 'Project';

/** The command listing the server's repositories, and with `withProjects` its projects too. */
export function repositoryListArgs(server: string, { withProjects }: { withProjects: boolean }): string[] {
  if (!withProjects) return ['repository', 'list', server, `--format=${recordFormat(REPOSITORY_FIELDS)}`];
  return ['repository', 'list', server, '--type=all', `--format=${recordFormat([...REPOSITORY_FIELDS, 'reptype'])}`];
}

/** The repositories and projects `repositoryListArgs` printed, each by name; a repository knows its project. */
export function parseRepositoryListing(output: string, server: string, { withProjects }: { withProjects: boolean }): RepositoryListing {
  const repositories: RepositorySummary[] = [];
  const projects: string[] = [];
  for (const [id = '', name = '', repositoryServer = server, owner = '', type = ''] of parseRecords(output)) {
    if (withProjects && type === PROJECT_TYPE) projects.push(name);
    else if (!withProjects || REPOSITORY_TYPES.has(type)) repositories.push({ id, name, server: repositoryServer, owner, spec: `${name}@${repositoryServer}` });
  }
  projects.sort(byName);
  repositories.sort((a, b) => byName(a.name, b.name));
  return { repositories: withProjectsOf(repositories, new Set(projects)), projects };
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

/** Whether `cm` failed the listing for not taking `--type`, whose refusal names the option in any language. */
export function refusesTypeOption(output: string): boolean {
  return output.includes('--type');
}
