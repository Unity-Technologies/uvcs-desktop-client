import type { ItemDetails, ItemMove, RevisionType, TreeItem } from '../domain/explorer';

export interface ExplorerApi {
  /** Children of a workspace directory (`''` is the root), including private items. */
  listDirectory(workspacePath: string, directory: string): Promise<TreeItem[]>;
  /** Children of a directory in the repository at a changeset, without a workspace. */
  listRepositoryDirectory(workspacePath: string, changesetId: number, directory: string): Promise<TreeItem[]>;
  /** Every path in the workspace, private ones included, for quick "go to file" searches. Read from disk, not `cm`. */
  listAllPaths(workspacePath: string): Promise<{ path: string; isDirectory: boolean }[]>;
  details(workspacePath: string, path: string): Promise<ItemDetails>;
  addRecursive(workspacePath: string, paths: string[]): Promise<void>;
  /** Moves or renames a controlled item (`cm mv`). */
  move(workspacePath: string, fromPath: string, toPath: string): Promise<void>;
  /** Renames a private item on disk: `cm mv` only moves controlled ones. Fails rather than replace an existing item. */
  renamePrivate(workspacePath: string, fromPath: string, toPath: string): Promise<void>;
  /** Moves items one after the other, as an operation; stops at the first that fails, and never replaces an existing item. */
  moveItems(workspacePath: string, moves: ItemMove[], operationId: string): Promise<void>;
  /** Creates an empty file or directory and adds it to version control. */
  create(workspacePath: string, path: string, kind: 'file' | 'directory'): Promise<void>;
  changeRevisionType(workspacePath: string, paths: string[], type: RevisionType): Promise<void>;
  /** Asks where to save a revision and downloads it there. Resolves to false if the user cancels. */
  saveRevisionAs(workspacePath: string, revisionId: number, fileName: string): Promise<boolean>;
  /** Downloads a revision to a temporary file and opens it with the default app. */
  openRevision(workspacePath: string, revisionId: number, fileName: string): Promise<void>;
}
