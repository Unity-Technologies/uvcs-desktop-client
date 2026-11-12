import { nameInProject, nameWithProject } from '@shared/domain/organizations';
import type { RepositorySummary } from '@shared/domain/repository';
import { isRepositoryNameTaken } from './workspaceNaming';

/**
 * The repositories a server's list shows: the live ones, and with `withDeleted` its deleted ones among them by name,
 * a live one first when they share a name.
 */
export function repositoriesShown(live: readonly RepositorySummary[], deleted: readonly RepositorySummary[], withDeleted: boolean): RepositorySummary[] {
  if (!withDeleted || deleted.length === 0) return [...live];
  return [...live, ...deleted].sort((a, b) => a.name.localeCompare(b.name) || Number(a.deleted ?? false) - Number(b.deleted ?? false));
}

/**
 * Restoring a deleted repository: under the name it had, unless a live repository took it, when a new one is asked
 * for. As a rename, the name is typed inside the repository's Unity project (`Old` for `Racing/Old`).
 */
export function repositoryRestore(deleted: RepositorySummary, liveNames: readonly string[]) {
  const project = deleted.project ?? null;
  const newName = (typed: string): string => nameWithProject(typed.trim(), project);
  return {
    needsNewName: isRepositoryNameTaken(deleted.name, liveNames),
    initialName: nameInProject(deleted.name, deleted.project),
    newName,
    isTaken: (typed: string): boolean => isRepositoryNameTaken(newName(typed), liveNames),
  };
}
