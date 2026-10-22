import { joinPath } from '../../lib/paths';

/** A workspace name for a repository: `acme/mergetool` → `mergetool`, made unique among `takenNames`. */
export function suggestWorkspaceName(repositoryName: string, takenNames: readonly string[]): string {
  const base = (repositoryName.split('/').at(-1) ?? repositoryName).trim() || 'workspace';
  const taken = new Set(takenNames.map((name) => name.toLowerCase()));
  if (!taken.has(base.toLowerCase())) return base;

  let suffix = 2;
  while (taken.has(`${base}-${suffix}`.toLowerCase())) suffix++;
  return `${base}-${suffix}`;
}

/** Where a new workspace goes unless the user picks a folder: a folder named after it in `root`; '' until both are known. */
export function defaultWorkspacePath(root: string | undefined, name: string): string {
  const folder = name.trim();
  return root && folder ? joinPath(root, folder) : '';
}

/** Whether a repository name as typed (spaces around it aside) names the repository `repositoryName`: `cm` tells names apart by case. */
function namesRepository(typed: string, repositoryName: string): boolean {
  return typed.trim() === repositoryName;
}

/** Whether a repository named `name` (as typed) is already among `repositoryNames`. */
export function isRepositoryNameTaken(name: string, repositoryNames: readonly string[]): boolean {
  return repositoryNames.some((repositoryName) => namesRepository(name, repositoryName));
}

/** The repository a name as typed names, if any. */
export function repositoryNamed<Repository extends { name: string }>(name: string, repositories: readonly Repository[]): Repository | undefined {
  return repositories.find((repository) => namesRepository(name, repository.name));
}

/** A repository whose name differs from the one typed only by case: to `cm` a different name, to a person likely the same. */
export function repositoryNamedButForCase<Repository extends { name: string }>(name: string, repositories: readonly Repository[]): Repository | undefined {
  const wanted = name.trim().toLowerCase();
  return repositories.find((repository) => !namesRepository(name, repository.name) && repository.name.toLowerCase() === wanted);
}

/**
 * Whether another workspace already goes by `name`. Names that differ only by case count as taken: `cm` would accept
 * them, but two workspaces told apart by case alone read as one. `ownName` is the workspace's own when renaming it.
 */
export function isWorkspaceNameTaken(name: string, workspaceNames: readonly string[], ownName?: string): boolean {
  const wanted = name.trim().toLowerCase();
  return workspaceNames.some((taken) => taken !== ownName && taken.toLowerCase() === wanted);
}
