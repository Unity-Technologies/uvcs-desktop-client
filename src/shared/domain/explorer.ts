import type { ItemType } from './pendingChanges';
import type { RevisionRef } from './revision';

/** One file or directory as listed by `cm ls`, in the workspace or in a repository tree. */
export interface TreeItem {
  /** Path relative to the root, with forward slashes and no leading slash, e.g. `src/app.ts`. */
  path: string;
  name: string;
  itemType: ItemType;
  size: number;
  date: string;
  /** Private items are not under version control, so they have no revision information. */
  isPrivate: boolean;
  isCheckedOut: boolean;
  /**
   * The changeset its revision was made in; null for a revision of a shelve (`shelveId`), which a workspace on a
   * shelve lists: `cm` numbers it as changeset `-id`, on no branch.
   */
  changeset: number | null;
  /** Set for a revision of a shelve. */
  shelveId?: number;
  branch: string;
  owner: string;
  revisionId: number;
  /** The revision before `revisionId`; -1 when this is the first one. */
  parentRevisionId: number;
  /**
   * The repository its revision, changeset and branch belong to (`name@server`): the workspace's, or under an xlink
   * (and for the xlink itself) the xlinked one. Empty for a private item.
   */
  repository: string;
  itemId: number;
  /** Set for a directory that is an xlink: where it points. */
  xlink?: XlinkTarget;
  /** Set for a symbolic link in the workspace: the path it points to, as written in the link. */
  symlinkTarget?: string;
}

/** Where an xlinked directory points: a changeset (and path) of another repository. */
export interface XlinkTarget {
  /** Writable xlinks (`wxlink`) take changes made under them; read-only ones don't. */
  writable: boolean;
  /** The directory of the target repository it shows, e.g. `/` or `/testprograms`. */
  path: string;
  changeset: number;
  /** The target repository's name, e.g. `thirdparty`. */
  repository: string;
  server: string;
}

/** Extra information about a workspace item, from `cm fileinfo`. */
export interface ItemDetails {
  serverPath: string;
  status: string;
  loadedChangeset: number;
  owner: string;
  hash: string;
  repository: string;
  changelist: string;
  xlinkTarget: string;
  underXlinkTarget: string;
}

export type RevisionType = 'bin' | 'txt';

/** An item to move into another folder (workspace-relative paths): controlled ones with `cm move`, private ones on disk. */
export interface ItemMove {
  from: string;
  to: string;
  isPrivate: boolean;
}

/**
 * A deleted item to bring back as a pending change: its last revision, the one the deletion removed (a diff's
 * `baseRevisionId`), restored at `path` (workspace-relative, forward slashes), where it was or anywhere else. A folder
 * comes back with everything it held then.
 */
export interface DeletedItemRestore {
  revision: RevisionRef;
  path: string;
}

/**
 * Why an item couldn't come back: its place is taken, its folder is gone, the workspace still has it (at `loadedPath`),
 * it is or holds an xlink, or its revision is of another repository than the workspace's.
 */
export interface RestoreRefusal {
  kind: 'placeTaken' | 'folderMissing' | 'alreadyLoaded' | 'xlink' | 'otherRepository';
  /** Where it was asked to go (workspace-relative), as in the `DeletedItemRestore`. */
  path: string;
  /** Where the workspace has it (workspace-relative), for `alreadyLoaded`. */
  loadedPath?: string;
  /** The refusal in the app's words. */
  message: string;
}

/** What restoring deleted items did: how many of them came back, and what stopped the rest (a refusal, the user). */
export interface RestoreOutcome {
  restored: number;
  total: number;
  refused?: RestoreRefusal;
  stopped?: boolean;
}
