import type {
  Changelist,
  CheckinRequest,
  CheckinResult,
  FilterRuleList,
  PendingChangesFilter,
  PendingChangesSnapshot,
} from '../domain/pendingChanges';

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
  shelve(workspacePath: string, paths: string[], comment: string): Promise<number>;
  createChangelist(workspacePath: string, changelist: Changelist): Promise<void>;
  editChangelist(workspacePath: string, name: string, changes: Changelist): Promise<void>;
  deleteChangelist(workspacePath: string, name: string): Promise<void>;
  /** Moves changes into a changelist, or back to the default one when `name` is null. */
  moveToChangelist(workspacePath: string, name: string | null, paths: string[]): Promise<void>;
}
