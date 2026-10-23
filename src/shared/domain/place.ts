/**
 * What a window shows: a workspace, or a repository explored without one (ARCHITECTURE.md "Places"). The
 * server's objects (branches, changesets, labels, diffs, histories…) read and change the same in both; only what lives
 * on the disk (pending changes, switching, updating, merging into the workspace) needs a workspace.
 *
 * APIs that work on the server take a `Place`; APIs that need the disk take a workspace's path, which a repository's
 * place has none of, so the type checker keeps the disk out of a repository's window.
 */
export type Place = WorkspacePlace | RepositoryPlace;

/** A workspace: `cm` reads its repository from its folder. */
export interface WorkspacePlace {
  readonly kind: 'workspace';
  readonly workspacePath: string;
}

/** A repository with no workspace: every command names it (`name@server`, as a `RepositorySummary`'s `spec`). */
export interface RepositoryPlace {
  readonly kind: 'repository';
  readonly repository: string;
}

export function workspacePlace(workspacePath: string): WorkspacePlace {
  return { kind: 'workspace', workspacePath };
}

export function repositoryPlace(repository: string): RepositoryPlace {
  return { kind: 'repository', repository };
}

/** The workspace's path, or null for a repository explored without one. */
export function workspacePathOf(place: Place): string | null {
  return place.kind === 'workspace' ? place.workspacePath : null;
}

/**
 * One string per place, for maps and cache keys: a workspace's path, or `repository:<spec>`. No path is written so
 * (an absolute path starts with `/`, a drive or `\\`), so a workspace and a repository never share one.
 */
export function placeId(place: Place): string {
  return place.kind === 'workspace' ? place.workspacePath : `repository:${place.repository}`;
}
