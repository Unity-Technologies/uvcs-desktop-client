import { nameInProject, nameWithProject } from '@shared/domain/organizations';
import type { RepositorySummary } from '@shared/domain/repository';
import { isRepositoryNameTaken } from './workspaceNaming';

/**
 * Renaming a repository as its row names it: inside its Unity project by its own name (`Game` for `Racing/Game`),
 * renamed within the project (`Racing/Game2`), and a name taken only by another of the project's repositories.
 */
export function repositoryRename(repository: RepositorySummary, takenNames: readonly string[]) {
  const project = repository.project ?? null;
  const newName = (typed: string): string => nameWithProject(typed.trim(), project);
  const othersNames = takenNames.filter((name) => name !== repository.name);
  return {
    initialName: nameInProject(repository.name, repository.project),
    newName,
    isTaken: (typed: string): boolean => isRepositoryNameTaken(newName(typed), othersNames),
  };
}
