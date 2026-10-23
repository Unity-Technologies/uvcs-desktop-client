import type {
  Changelist,
  CheckinRequest,
  CheckinResult,
  FilterRuleList,
  MovePair,
  PendingChangesFilter,
  PendingChangesSnapshot,
} from '../domain/pendingChanges';
import type { ShelveAwayRequest, ShelvedAway } from '../domain/shelve';

export interface PendingChangesApi {
  list(workspacePath: string, filter: PendingChangesFilter): Promise<PendingChangesSnapshot>;
  checkin(workspacePath: string, request: CheckinRequest, operationId: string): Promise<CheckinResult>;
  undo(workspacePath: string, paths: string[]): Promise<void>;
  /** Undoes the checkouts whose contents didn't change: of the given paths, or of the whole workspace. */
  undoUnchanged(workspacePath: string, paths?: string[]): Promise<void>;
  add(workspacePath: string, paths: string[]): Promise<void>;
  remove(workspacePath: string, paths: string[]): Promise<void>;
  /**
   * Records a move the local-move detection didn't pair: an item deleted from disk (`locallyDeleted`) became the
   * private one at `newPath`, which keeps its content. Nothing on disk changes (`cm move` of a missing item).
   */
  recordMove(workspacePath: string, deletedPath: string, newPath: string): Promise<void>;
  /**
   * How alike each pair's files are, from 0 to 1, in their order, as `cm`'s move detection measures it
   * (`main/workspace/moveSimilarity`); null where it can't tell (a folder, a file too large or unreadable). Reads the
   * deleted text files' loaded revisions with one `cm cat` for all of them, the new ones from disk.
   */
  moveSimilarities(workspacePath: string, pairs: MovePair[]): Promise<(number | null)[]>;
  checkout(workspacePath: string, paths: string[]): Promise<void>;
  /** Appends patterns to `ignore.conf`, `cloaked.conf` or `hidden_changes.conf`, leaving out those already there. */
  addFilterRules(workspacePath: string, list: FilterRuleList, patterns: string[]): Promise<void>;
  /** Shelves the changes and keeps them in the workspace. Resolves to the shelve's id. */
  shelve(workspacePath: string, paths: string[], comment: string, operationId: string): Promise<number>;
  /**
   * Shelves away the requested changes (`ShelveAwayRequest`; every pending change when null), checks the shelve holds
   * them all, then undoes them and moves the files they added aside until the shelve is applied.
   */
  shelveAndUndo(workspacePath: string, request: ShelveAwayRequest | null, comment: string, operationId: string): Promise<ShelvedAway>;
  createChangelist(workspacePath: string, changelist: Changelist): Promise<void>;
  /** Renames or describes the changelist `name`: only the fields `edit` holds, one command each. */
  editChangelist(workspacePath: string, name: string, edit: Partial<Changelist>): Promise<void>;
  deleteChangelist(workspacePath: string, name: string): Promise<void>;
  /** Moves changes into a changelist, or back to the default one when `name` is null. */
  moveToChangelist(workspacePath: string, name: string | null, paths: string[]): Promise<void>;
}
