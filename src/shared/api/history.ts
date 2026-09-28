import type { ItemHistory } from '../domain/history';
import type { RevisionRef } from '../domain/revision';

export interface HistoryApi {
  /**
   * Revisions, moves and removals of a workspace-relative file or directory; with `revision`, of the item that
   * revision is of (browsing a changeset, a diff), wherever it is.
   */
  forItem(workspacePath: string, path: string, revision?: RevisionRef): Promise<ItemHistory>;
  /** Loads the content of a past revision into the workspace as a pending change. */
  revertTo(workspacePath: string, path: string, changesetId: number): Promise<void>;
  /** Asks where to save a revision and writes it there. Resolves to the saved path, or null if cancelled. */
  saveRevisionAs(workspacePath: string, revision: RevisionRef, suggestedFileName: string): Promise<string | null>;
  /** Opens a past revision with the default app for its file type. */
  openRevision(workspacePath: string, revision: RevisionRef, fileName: string): Promise<void>;
}
