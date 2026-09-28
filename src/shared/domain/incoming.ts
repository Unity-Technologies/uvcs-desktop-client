import type { Changeset } from './changeset';
import type { DiffEntry } from './diff';
import type { FileConflictResolution } from './merge';

/** Where the workspace stands, as its workspace info tells: what the incoming check compares the branch head with. */
export interface LoadedBranch {
  /** Null when the workspace is not loaded from a branch. */
  branch: string | null;
  loadedChangeset: number;
}

/** A cheap check of how far behind its branch head the workspace is. */
export interface IncomingSummary {
  /** Null when the workspace is not loaded from a branch (e.g. a label), so nothing comes in. */
  branch: string | null;
  loadedChangeset: number;
  headChangeset: number;
  changesetCount: number;
  /** Who checked in the incoming changesets, newest first, each once. */
  authors: string[];
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

export interface IncomingChanges extends IncomingSummary {
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
