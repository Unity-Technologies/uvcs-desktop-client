import { joinPath } from '../../lib/paths';

/** A workspace name for a repository: `codice/unitymerge` → `unitymerge`, made unique among `takenNames`. */
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

/** Whether a repository named `name` (as typed) is already among `repositoryNames`: `cm` tells names apart by case. */
export function isRepositoryNameTaken(name: string, repositoryNames: readonly string[]): boolean {
  return repositoryNames.includes(name.trim());
}
