export interface RepositorySummary {
  id: string;
  name: string;
  server: string;
  owner: string;
  /** `name@server`, ready to use as a repository spec. */
  spec: string;
}

/** A server the client has credentials for, from `cm profile list`. */
export interface ServerProfile {
  server: string;
  user: string;
  workingMode: string;
}

/**
 * Whether an item of `repository` is in the place's (a workspace's, or a repository explored without one): undefined
 * while the place's isn't known yet, so a caller doesn't act on an xlinked repository's item meanwhile (list the wrong
 * tree, restore the wrong revision).
 */
export function inPlaceRepository(repository: string, placeRepository: string | undefined): boolean | undefined {
  return placeRepository === undefined ? undefined : repository === placeRepository;
}

/**
 * `repository` when it isn't the workspace's: an item under an xlink lives in the xlinked repository, whose changesets,
 * branches and labels the workspace's views (changeset diffs, the Branch Explorer, label lists) know nothing of.
 * Undefined for the workspace's own, for none (a private item) and while the workspace's is unknown.
 */
export function otherRepository(repository: string | undefined, workspaceRepository: string | undefined): string | undefined {
  return repository && workspaceRepository && repository !== workspaceRepository ? repository : undefined;
}
