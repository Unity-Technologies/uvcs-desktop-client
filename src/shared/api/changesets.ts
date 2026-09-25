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
}
