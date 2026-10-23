export interface RepositorySummary {
  id: string;
  name: string;
  server: string;
  owner: string;
  /** `name@server`, ready to use as a repository spec. */
  spec: string;
  /** The Unity project it belongs to, in a Unity organization (`Racing` for `Racing/Game`); none elsewhere. */
  project?: string;
}

/** What a server holds: its repositories by name, and in a Unity organization its projects by name, empty ones too. */
export interface RepositoryListing {
  repositories: RepositorySummary[];
  projects: string[];
}

/** A server the client has credentials for, from `cm profile list`. */
export interface ServerProfile {
  server: string;
  user: string;
  workingMode: string;
}

/**
 * Whether an item of `repository` is in the workspace's: undefined while the workspace's isn't known yet, so a caller
 * doesn't act on an xlinked repository's item meanwhile (list the wrong tree, restore the wrong revision).
 */
export function inWorkspaceRepository(repository: string, workspaceRepository: string | undefined): boolean | undefined {
  return workspaceRepository === undefined ? undefined : repository === workspaceRepository;
}

/**
 * `repository` when it isn't the workspace's: an item under an xlink lives in the xlinked repository, whose changesets,
 * branches and labels the workspace's views (changeset diffs, the Branch Explorer, label lists) know nothing of.
 * Undefined for the workspace's own, for none (a private item) and while the workspace's is unknown.
 */
export function otherRepository(repository: string | undefined, workspaceRepository: string | undefined): string | undefined {
  return repository && workspaceRepository && repository !== workspaceRepository ? repository : undefined;
}
