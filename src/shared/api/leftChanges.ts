import type { KnownBranch } from '../domain/branch';
import type { LeftChanges, RestoreResult } from '../domain/switchWithChanges';

/** Changes shelved when switching away, waiting on the branch (or changeset, label) they were left on. */
export interface LeftChangesApi {
  /**
   * Left on what the workspace is on now, newest first: by this app first, then by another workspace or app.
   * `branch`, the workspace's branch as the window already read it, spares looking its id up again; it is used only
   * while the workspace is still on that branch.
   */
  find(workspacePath: string, branch?: KnownBranch): Promise<LeftChanges[]>;
  /** Applies the shelve when it merges cleanly, then deletes it; otherwise reports why it wasn't applied. */
  restore(workspacePath: string, shelveId: number, operationId: string): Promise<RestoreResult>;
  /** Deletes the shelves for good. */
  discard(workspacePath: string, shelveIds: number[]): Promise<void>;
}
