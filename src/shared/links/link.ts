/**
 * What a `uvcs://` link names (docs/features/deep-links.md): a repository's object and a page in it, a workspace on
 * this computer and a page in it, and the lines to show; or a server's repositories, a Unity project's.
 * `formatLink` writes one, `parseLink` reads one.
 */
export type Link = RepositoryLink | WorkspaceLink | ServerLink;

/** The repositories of a server or organization, on the home screen: a Unity organization's project's when named. */
export interface ServerLink {
  kind: 'server';
  /** As `cm` takes it: `acme@unity`, `host:8087`, `local`. */
  server: string;
  /** A Unity project of the organization, by name. */
  project?: string;
}

/** A link anyone with access can open: it names a server and a repository, never the workspace of who copied it. */
export interface RepositoryLink {
  kind: 'repository';
  /** As `cm` takes it: `acme@unity`, `host:8087`, `local`. */
  server: string;
  /** The repository's name, without its server. */
  repository: string;
  object?: LinkObject;
  page?: LinkPage;
  lines?: LinkLines;
}

/**
 * A link to a workspace on this computer, for agents and scripts: the app never copies one. `folder` is the folder as
 * the link wrote it, with `/` separators (`/Users/ana/wk/game`, `C:/wk/game`): the workspace's root, a folder or a file
 * in it when the link names no page.
 */
export interface WorkspaceLink {
  kind: 'workspace';
  folder: string;
  page?: LinkPage;
  lines?: LinkLines;
}

export type LinkObject =
  | { kind: 'changeset'; id: number }
  /** What `to`'s changesets after `from` changed, `from` excluded, as `cm diff cs:from cs:to` reads it. */
  | { kind: 'changesetRange'; from: number; to: number }
  /** `name` as `cm` writes it: `/main/task001`. */
  | { kind: 'branch'; name: string }
  | { kind: 'label'; name: string }
  | { kind: 'labelRange'; from: string; to: string }
  | { kind: 'shelve'; id: number }
  /** `asMergeRequest`: written as a merge request (`merge-requests/311`), which is the same review. */
  | { kind: 'codeReview'; id: number; asMergeRequest?: boolean };

/** A view of the workspace, as a link names it. */
export const LINK_VIEWS = [
  'changes',
  'incoming',
  'files',
  'changesets',
  'branch-explorer',
  'branches',
  'labels',
  'shelves',
  'attributes',
  'code-reviews',
  'locks',
  'sync',
] as const;

export type LinkView = (typeof LINK_VIEWS)[number];

/**
 * A page inside what the link names. Paths are the repository's (`/Assets/Player.cs`, `/` for its root), relative to
 * the workspace's root in a workspace link.
 * - `view`: a view of the workspace (a repository or workspace link), on an item for `files` (revealed in Files) and
 *   `changes` (selected in Changes), or the Branch Explorer on the object.
 * - `diffFile`: the object's diff, on that file.
 * - `browse`, `history`, `annotate`: the item as it was at the object (the head of /main for none, the workspace's
 *   own in a workspace link).
 */
export type LinkPage =
  | { kind: 'view'; view: LinkView; path?: string }
  | { kind: 'diffFile'; path: string }
  | { kind: 'browse'; path: string }
  | { kind: 'history'; path: string }
  | { kind: 'annotate'; path: string };

/** Lines `first` to `last` of the newer side (a file's only side outside a diff), or of the older one in a diff. */
export interface LinkLines {
  side: 'new' | 'old';
  first: number;
  last: number;
}
