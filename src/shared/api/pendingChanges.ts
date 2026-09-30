import type {
  Changelist,
  CheckinRequest,
  CheckinResult,
  FilterRuleList,
  PendingChangesFilter,
  PendingChangesSnapshot,
} from '../domain/pendingChanges';
import type { ShelvedAway } from '../domain/shelve';

export interface PendingChangesApi {
  list(workspacePath: string, filter: PendingChangesFilter): Promise<PendingChangesSnapshot>;
  checkin(workspacePath: string, request: CheckinRequest, operationId: string): Promise<CheckinResult>;
  undo(workspacePath: string, paths: string[]): Promise<void>;
  /** Undoes the checkouts whose contents didn't change: of the given paths, or of the whole workspace. */
  undoUnchanged(workspacePath: string, paths?: string[]): Promise<void>;
  add(workspacePath: string, paths: string[]): Promise<void>;
  remove(workspacePath: string, paths: string[]): Promise<void>;
  checkout(workspacePath: string, paths: string[]): Promise<void>;
  /** Appends a pattern to `ignore.conf`, `cloaked.conf` or `hidden_changes.conf`. */
  addFilterRule(workspacePath: string, list: FilterRuleList, pattern: string): Promise<void>;
  /** Shelves the changes and keeps them in the workspace. Resolves to the shelve's id. */
  shelve(workspacePath: string, paths: string[], comment: string, operationId: string): Promise<number>;
  /**
   * Shelves the changes (every pending change when `paths` is null), checks the shelve holds them all, then undoes them
   * and moves the files they added aside until the shelve is applied.
   */
  shelveAndUndo(workspacePath: string, paths: string[] | null, comment: string, operationId: string): Promise<ShelvedAway>;
  createChangelist(workspacePath: string, changelist: Changelist): Promise<void>;
  /** Renames or describes the changelist `name`: only the fields `edit` holds, one command each. */
  editChangelist(workspacePath: string, name: string, edit: Partial<Changelist>): Promise<void>;
  deleteChangelist(workspacePath: string, name: string): Promise<void>;
  /** Moves changes into a changelist, or back to the default one when `name` is null. */
  moveToChangelist(workspacePath: string, name: string | null, paths: string[]): Promise<void>;
}
