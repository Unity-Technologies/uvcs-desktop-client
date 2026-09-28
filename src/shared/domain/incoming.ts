import type { Changeset } from './changeset';
import type { DiffEntry } from './diff';
import type { FileConflictResolution } from './merge';

/**
 * Where the workspace stands on its branch, as its workspace info tells: what the incoming check compares the branch
 * head with. Null off a branch (a changeset, label or shelve).
 */
export type LoadedBranch = { branch: string; loadedChangeset: number } | null;

/** A cheap check of how far behind its branch head the workspace is. */
export type IncomingSummary = BranchIncoming | NothingIncoming;

export interface BranchIncoming {
  branch: string;
  loadedChangeset: number;
  headChangeset: number;
  changesetCount: number;
  /** Who checked in the incoming changesets, newest first, each once. */
  authors: string[];
}

/** Off a branch (a changeset, label or shelve), nothing comes in, and there is no head to be behind of. */
export interface NothingIncoming {
  branch: null;
  changesetCount: 0;
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

export type IncomingChanges = BranchIncomingChanges | (NothingIncoming & IncomingDetails);

export type BranchIncomingChanges = BranchIncoming & IncomingDetails;

interface IncomingDetails {
  /** Newest first. */
  changesets: Changeset[];
  /** Every item that changes between the loaded changeset and the head. */
  files: DiffEntry[];
  conflicts: UpdateConflict[];
  /**
   * Locally changed files that the branch deleted or moved. They can't be merged while updating:
   * the user has to check them in, shelve them or undo them first.
   */
  blockedPaths: string[];
}

/**
 * How to resolve an update conflict, keyed by path. `source` keeps the incoming version,
 * `destination` keeps the local one.
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
