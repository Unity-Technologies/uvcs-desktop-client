export interface RepositorySummary {
  id: string;
  name: string;
  server: string;
  owner: string;
  /** `name@server`, ready to use as a repository spec. */
  spec: string;
  /** The Unity project it belongs to, in a Unity organization (`Racing` for `Racing/Game`); none elsewhere. */
  project?: string;
  /**
   * Deleted, and still restorable: the server keeps a deleted repository for a while and lists it to its
   * administrators. Its `name` is the one it had; its `spec` names it by GUID (`<guid>@server`), as
   * `cm repository undelete` takes it: several deleted repositories may share a name.
   */
  deleted?: true;
}

/** A Unity organization's project: its GUID decides its color in every client (`projectColor`). */
export interface UnityProject {
  name: string;
  guid: string;
}

/**
 * What a server holds: its repositories by name, and in a Unity organization its projects by name, empty ones too.
 * The deleted repositories the server still keeps come apart, by name, so only what asks for them sees them.
 */
export interface RepositoryListing {
  repositories: RepositorySummary[];
  projects: UnityProject[];
  deletedRepositories: RepositorySummary[];
}

/** A server the client has credentials for, from `cm profile list`. */
export interface ServerProfile {
  server: string;
  user: string;
  workingMode: string;
}

/** A protocol a server may be written with (`ssl://host:8088`), which names the same server as `host:8088`; links leave it out. */
export const SERVER_PROTOCOL = /^(?:ssl|udt|tcp):\/\//i;

/**
 * One form for a server however it's written: by host and port without the protocol (`ssl://host:8088` → `host:8088`),
 * an organization's name in any case (`ACME@unity` → `acme@unity`). `acme@unity` and `acme@cloud` stay apart.
 */
export function serverKey(server: string): string {
  return server.replace(SERVER_PROTOCOL, '').toLowerCase();
}

/**
 * One form for a repository spec (`name@server`) however a workspace, a link or `cm` writes it: its name in any case,
 * as `cm` takes it, and its server as `serverKey` gives it. Repository names hold no `@`, so the server is everything
 * after the first one. For what is kept or matched per repository (`isRepository`, recent comments).
 */
export function repositoryKey(repositorySpec: string): string {
  const at = repositorySpec.indexOf('@');
  if (at === -1) return repositorySpec.toLowerCase();
  return `${repositorySpec.slice(0, at).toLowerCase()}@${serverKey(repositorySpec.slice(at + 1))}`;
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
