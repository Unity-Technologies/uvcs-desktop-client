import type { LeftChanges, RestoreResult } from '../domain/switchWithChanges';

/** Changes shelved when switching away, waiting on the branch (or changeset, label) they were left on. */
export interface LeftChangesApi {
  /** Left on what the workspace is on now, newest first: by this app first, then by another workspace or app. */
  find(workspacePath: string): Promise<LeftChanges[]>;
  /** Applies the shelve when it merges cleanly, then deletes it; otherwise reports why it wasn't applied. */
  restore(workspacePath: string, shelveId: number, operationId: string): Promise<RestoreResult>;
  /** Deletes the shelves for good. */
  discard(workspacePath: string, shelveIds: number[]): Promise<void>;
}
