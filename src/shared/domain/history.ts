import type { ItemType } from './pendingChanges';

/** One revision of a file or directory, as listed by its history. */
export interface ItemRevision {
  revisionId: number;
  /** The revision it was made from (-1 for the one that added the item): on another branch, often not the one listed below it. */
  parentRevisionId: number;
  changesetId: number;
  branch: string;
  owner: string;
  date: string;
  /** Comment of the changeset that created the revision. */
  comment: string;
  itemType: ItemType;
  size: number;
  /**
   * The repository the item lives in, whose changesets and branches these are (`name@server`): the workspace's, or for
   * a file under an xlink the xlinked one.
   */
  repository: string;
  /** This very revision wherever the file was then, e.g. `revid:45@game@local`. */
  idSpec: string;
}

/** A changeset that moved, renamed or removed the item: `cm` lists it apart from the revisions, which only content changes make. */
export interface ItemPathChange {
  changesetId: number;
  owner: string;
  date: string;
  /** What it did, in `cm`'s words: "Moved from /src/a.cs to /src/b.cs", "Removed /src/a.cs". */
  description: string;
}

/** A file's or directory's history, each list newest first. */
export interface ItemHistory {
  revisions: ItemRevision[];
  pathChanges: ItemPathChange[];
  /** The revision the workspace has, for the history of a workspace file; none for a private or deleted one. */
  workspaceRevisionId?: number;
}
