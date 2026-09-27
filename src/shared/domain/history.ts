import type { ItemType } from './pendingChanges';

/** One revision of a file or directory, as listed by its history. */
export interface ItemRevision {
  revisionId: number;
  changesetId: number;
  branch: string;
  owner: string;
  date: string;
  /** Comment of the changeset that created the revision. */
  comment: string;
  itemType: ItemType;
  size: number;
  /** Spec to load this revision, e.g. `src/app.ts#cs:12`. It names the file's path now: before a move, `cm` finds nothing there. */
  spec: string;
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
}
