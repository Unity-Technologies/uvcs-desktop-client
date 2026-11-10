import type { CreateWorkspaceRequest } from '@shared/api/workspaces';

/**
 * The `cm workspace create` arguments for a new workspace on /main of its repository. A regular workspace names the
 * repository; a dynamic one names what it loads instead (`--tree`, a branch, changeset or label spec), since `cm`
 * ignores the repository argument with `--dynamic`.
 */
export function workspaceCreateArgs({ name, path, repository, kind }: CreateWorkspaceRequest): string[] {
  if (kind !== 'dynamic') return ['workspace', 'create', name, path, repository];
  return ['workspace', 'create', name, path, '--dynamic', `--tree=br:/main@${repository}`];
}
