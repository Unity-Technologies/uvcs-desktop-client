import type {
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
  undoUnchanged(workspacePath: string): Promise<void>;
  add(workspacePath: string, paths: string[]): Promise<void>;
  remove(workspacePath: string, paths: string[]): Promise<void>;
  checkout(workspacePath: string, paths: string[]): Promise<void>;
  /** Appends a pattern to `ignore.conf`, `cloaked.conf` or `hidden_changes.conf`. */
  addFilterRule(workspacePath: string, list: FilterRuleList, pattern: string): Promise<void>;
  shelve(workspacePath: string, paths: string[], comment: string): Promise<number>;
}
