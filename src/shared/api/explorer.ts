import type { Place, RepositoryPlace } from '../domain/place';
import type { DeletedItemRestore, FoundPath, ItemDetails, RestoreOutcome, ItemMove, RevisionType, TreeItem } from '../domain/explorer';

export interface ExplorerApi {
  /** Children of a workspace directory (`''` is the root), including private items. */
  listDirectory(workspacePath: string, directory: string): Promise<TreeItem[]>;
  /** Children of a directory in the repository at a changeset, without a workspace. */
  listRepositoryDirectory(place: Place, changesetId: number, directory: string): Promise<TreeItem[]>;
  /**
   * The best matches of `query` among a repository's files and folders at a changeset, explored without a workspace
   * (docs/features/explore-repository.md, "Finding a file"): the first search of a changeset lists its tree from the
   * server, which every later one reads from a file of the session's. The best ones found meanwhile come as
   * `repositoryPathsFound` events with `searchId`. Fails as the listing does; a search stopped resolves what it found.
   */
  findRepositoryPaths(place: RepositoryPlace, changesetId: number, query: string, searchId: string): Promise<FoundPath[]>;
  /**
   * Starts listing a repository's tree at a changeset for `findRepositoryPaths`, unless it is listed or listing: Go to
   * file opened, so the listing runs while the query is typed. Resolves at once; the searches meet its failure.
   */
  prepareRepositoryPaths(place: RepositoryPlace, changesetId: number): Promise<void>;
  /** Stops a search of `findRepositoryPaths`: a newer query replaced it, or its dialog closed. Its tree is kept. */
  stopFindingRepositoryPaths(searchId: string): Promise<void>;
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
  /**
   * Brings deleted items of the workspace's repository back as pending changes (`cm undelete`), one after the other,
   * as an operation; checks first that each place is free and its folder there. Resolves with how many came back and
   * what stopped the rest (a refusal, the user); fails only on another failure.
   */
  restoreDeleted(workspacePath: string, restores: DeletedItemRestore[], operationId: string): Promise<RestoreOutcome>;
  /** Creates an empty file or directory and adds it to version control. */
  create(workspacePath: string, path: string, kind: 'file' | 'directory'): Promise<void>;
  changeRevisionType(workspacePath: string, paths: string[], type: RevisionType): Promise<void>;
}
