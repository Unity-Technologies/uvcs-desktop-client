import type { Changeset } from '../domain/changeset';
import type { QueryFilter } from '../domain/query';

export interface ChangesetsApi {
  /** Newest first. */
  list(workspacePath: string, filter: QueryFilter): Promise<Changeset[]>;
  get(workspacePath: string, changesetId: number): Promise<Changeset>;
  editComment(workspacePath: string, changesetId: number, comment: string): Promise<void>;
  /** Moves the changeset and its descendants to another branch (full name, e.g. `/main/fix`). */
  moveToBranch(workspacePath: string, changesetId: number, branch: string): Promise<void>;
  remove(workspacePath: string, changesetId: number): Promise<void>;
  /**
   * Makes the workspace contents match a previous changeset of the loaded branch, as pending changes:
   * a subtractive merge of everything after it.
   */
  revertWorkspaceTo(workspacePath: string, changesetId: number, operationId: string): Promise<void>;
}
