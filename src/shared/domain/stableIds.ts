// What the app keeps an object by, so that a rename never loses what it kept for it (ARCHITECTURE.md "Settings
// survive renames"). A name changes with a rename; a GUID never does. A branch, changeset, shelve or code review keeps
// its GUID on every replica of its repository, while its number changes; a repository's GUID is its own on each server
// (a replica made by `cm sync` gets a new one), which suits what is kept per repository on the server that holds it.
//
// Each kind of GUID is a type of its own, made only from text shaped as a GUID (`parseGuid`): a name can't be passed
// where a GUID is kept, nor one object's GUID where another kind's is.

declare const stableIdKind: unique symbol;

/** A GUID as `cm` prints it (`{guid}`, `{repguid}`), of one kind of object. */
type Guid<Kind extends string> = string & { readonly [stableIdKind]: Kind };

/** A repository's `{repguid}` (`cm repository list`): it stays through a rename; a replica on another server has its own. */
export type RepositoryGuid = Guid<'repository'>;

/** A workspace's GUID (`cm getworkspacefrompath --format={guid}`, a local read): it stays through a rename and a move. */
export type WorkspaceGuid = Guid<'workspace'>;

/** A branch's `{guid}` (`cm find branch`): the same on every replica, through renames. */
export type BranchGuid = Guid<'branch'>;

/** A Unity project's GUID: a project is a repository of its own type, listed with its `{repguid}`. */
export type ProjectGuid = Guid<'project'>;

/**
 * A Unity organization's id, the digits `cm getconfig organization` prints as `{unityid}` (`1375943370549`): an
 * organization's name (`acme` in `acme@unity`) can be changed by its owners, its id never. It is what recognizes an
 * organization under its new name, and is never shown nor passed to `cm` (ARCHITECTURE.md "Unity organizations").
 */
export type OrganizationId = string & { readonly [stableIdKind]: 'organization' };

/** The id `text` holds, or undefined for none: `-1`, which `cm` prints for an organization that isn't a Unity one, or an empty field. */
export function parseOrganizationId(text: string): OrganizationId | undefined {
  const trimmed = text.trim();
  return /^\d+$/.test(trimmed) ? (trimmed as OrganizationId) : undefined;
}

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseRepositoryGuid(text: string): RepositoryGuid | undefined {
  return parseGuid(text);
}

export function parseWorkspaceGuid(text: string): WorkspaceGuid | undefined {
  return parseGuid(text);
}

export function parseBranchGuid(text: string): BranchGuid | undefined {
  return parseGuid(text);
}

export function parseProjectGuid(text: string): ProjectGuid | undefined {
  return parseGuid(text);
}

/**
 * The GUID `text` holds, in lower case as `cm` prints it, or undefined when it holds none: an empty field (a `cm` that
 * doesn't know the placeholder prints it empty) or a name.
 */
function parseGuid<Kind extends string>(text: string): Guid<Kind> | undefined {
  const trimmed = text.trim();
  return GUID.test(trimmed) ? (trimmed.toLowerCase() as Guid<Kind>) : undefined;
}
