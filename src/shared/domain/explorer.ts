import type { ItemType } from './pendingChanges';

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
  /** The target repository's name, e.g. `nervathirdparty`. */
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
