import type { Changeset } from './changeset';
import type { DiffEntry } from './diff';
import type { FileConflictResolution } from './merge';

/**
 * Where the workspace stands on its branch, as its workspace info tells: what the incoming check compares the branch
 * head with. Null off a branch (a changeset, label or shelve).
 */
export type LoadedBranch = BranchAtChangeset | PartialBranch | null;

/** A workspace loaded from one changeset of its branch. */
export interface BranchAtChangeset {
  branch: string;
  loadedChangeset: number;
}

/**
 * A partial workspace on a branch: each of its items may be at another changeset of the branch, so no one changeset
 * tells where it stands; what comes in is told by comparing its items with the branch head's (`PartialIncomingChanges`).
 */
export interface PartialBranch {
  branch: string;
  partial: true;
}

/** A cheap check of how far behind its branch head the workspace is. */
export type IncomingSummary = BranchIncoming | PartialIncoming | NothingIncoming;

/** How many incoming changesets a page of Incoming reads at a time, newest first. */
export const INCOMING_CHANGESETS_PAGE = 200;

export interface BranchIncoming {
  branch: string;
  loadedChangeset: number;
  headChangeset: number;
  /** How many changesets came in, up to what was read: with `countCapped`, at least this many. */
  changesetCount: number;
  /**
   * There are more than `changesetCount`: reads stop counting (100 for the check, a page for Incoming), so a workspace
   * 100,000 changesets behind costs the server as much as one 100 behind. Shown as "100+".
   */
  countCapped: boolean;
  /** Who checked in the incoming changesets counted, newest first, each once. */
  authors: string[];
}

/** What updating a partial workspace brings, counted in its items rather than in changesets. */
export interface PartialIncoming {
  branch: string;
  partial: true;
  /** The branch head the items were compared with. */
  headChangeset: number;
  /** How many of the workspace's items the head changes, moves, removes or adds to its folders. */
  itemCount: number;
}

/** Off a branch (a changeset, label or shelve), nothing comes in, and there is no head to be behind of. */
export interface NothingIncoming {
  branch: null;
  changesetCount: 0;
  countCapped: false;
  authors: [];
}

/** A file changed both locally and by an incoming changeset. Updating needs to merge it. */
export interface UpdateConflict {
  /** Workspace-relative path, e.g. `src/app.ts`. */
  path: string;
  isBinary: boolean;
  /** The revision the workspace has loaded (the common ancestor). */
  baseRevisionId: number;
  /** The revision on the branch head. */
  incomingRevisionId: number;
  /** The repository both revisions belong to: the workspace's, or under an xlink the xlinked one. */
  repository: string;
}

export type IncomingChanges = ChangesetIncomingChanges | PartialIncomingChanges;

/** What updating a workspace loaded from one changeset brings: the changesets after it, and the files they change. */
export type ChangesetIncomingChanges = BranchIncomingChanges | (NothingIncoming & IncomingDetails);

/**
 * What updating a partial workspace brings: its items that differ on the branch head. Updating a partial workspace
 * takes each item to the head, whatever changesets brought it there, so there are no changesets to list.
 */
export interface PartialIncomingChanges {
  branch: string;
  partial: true;
  headChangeset: number;
  items: PartialIncomingItem[];
}

/**
 * How the head differs from an item the workspace has: `changed` its content, `moved` its name or folder (its content
 * may have changed too), `removed` from the branch, or `added`: new in a folder the workspace has.
 */
export type PartialIncomingKind = 'changed' | 'moved' | 'removed' | 'added';

export interface PartialIncomingItem {
  kind: PartialIncomingKind;
  /** Workspace-relative path with forward slashes: where the head puts it, or where it is for a `removed` one. */
  path: string;
  /** Where it is in the workspace, for a `moved` one. */
  oldPath?: string;
  isDirectory: boolean;
  /**
   * Changed locally and on the head. Updating a partial workspace keeps the local version: the head's comes in only
   * once the local change is checked in, shelved or undone.
   */
  conflict: boolean;
  /** The revision the workspace has; null for an `added` one. */
  loadedRevisionId: number | null;
  /** The head's revision; null for a `removed` one. */
  headRevisionId: number | null;
}

export type BranchIncomingChanges = BranchIncoming & IncomingDetails;

interface IncomingDetails {
  /** The newest `INCOMING_CHANGESETS_PAGE`, newest first; `incomingChangesets` reads the older ones, page by page. */
  changesets: Changeset[];
  /** Older incoming changesets than those in `changesets` remain to be read. */
  moreChangesets: boolean;
  /** Every item that changes between the loaded changeset and the head. */
  files: DiffEntry[];
  conflicts: UpdateConflict[];
  /**
   * Locally changed files that the branch deleted or moved. They can't be merged while updating:
   * the user has to check them in, shelve them or undo them first.
   */
  blockedPaths: string[];
}

/** A page of incoming changesets, newest first, and whether older ones remain. */
export interface IncomingChangesetPage {
  changesets: Changeset[];
  more: boolean;
}

/** Which incoming changesets to read: the newest `limit` after the loaded one, older than `olderThan` when given. */
export interface IncomingChangesetsRequest {
  branch: string;
  loadedChangeset: number;
  olderThan?: number;
  limit: number;
}

/**
 * How to resolve an update conflict, keyed by path. `source` keeps the incoming version,
 * `destination` keeps the local one, `base` the revision the workspace had loaded.
 */
export type UpdateResolutions = Record<string, FileConflictResolution>;

export interface UpdateResult {
  /** Where the local versions of the conflicting files were saved before updating. */
  backupDirectory: string | null;
}

/** The locally changed files the branch deleted or moved, shelved so the workspace could update. */
export interface ShelvedForUpdate {
  shelveId: number;
  count: number;
  /** False when other files still need merging: the workspace waits for them in Incoming. */
  updated: boolean;
  /** Where the local versions of the merged files were saved, when it updated merging some. */
  backupDirectory: string | null;
}
