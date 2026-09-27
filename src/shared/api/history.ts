import type { ItemHistory } from '../domain/history';

export interface HistoryApi {
  /**
   * Revisions, moves and removals of a workspace-relative file or directory; with `changesetId`, of the item at that
   * repository path in that changeset.
   */
  forItem(workspacePath: string, path: string, changesetId?: number): Promise<ItemHistory>;
  /** Loads the content of a past revision into the workspace as a pending change. */
  revertTo(workspacePath: string, path: string, changesetId: number): Promise<void>;
  /** Asks where to save a revision and writes it there. Resolves to the saved path, or null if cancelled. */
  saveRevisionAs(workspacePath: string, revisionId: number, suggestedFileName: string): Promise<string | null>;
  /** Opens a past revision with the default app for its file type. */
  openRevision(workspacePath: string, revisionId: number, fileName: string): Promise<void>;
}
