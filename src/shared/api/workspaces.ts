import type { WorkspaceInfo, WorkspaceSummary } from '../domain/workspace';

export interface CreateWorkspaceRequest {
  name: string;
  path: string;
  repository: string;
}

/**
 * How much of a workspace the watcher sees. `full`: every change on disk. `partial` (Linux, or where a recursive
 * watch fails): the workspace root and `.plastic` only, so edits in subfolders need another refresh trigger.
 */
export type WatchCoverage = 'full' | 'partial';

export interface WorkspacesApi {
  list(): Promise<WorkspaceSummary[]>;
  info(workspacePath: string): Promise<WorkspaceInfo>;
  /**
   * Which repository each workspace works on (`name@server`), or null when it can't be told quickly
   * (missing folder, unreachable server). Costs one `cm` call per workspace, so only the first 10 paths
   * are looked up: pass the few workspaces on screen (e.g. the recent ones), never the whole list.
   */
  repositoriesOf(workspacePaths: string[]): Promise<Record<string, string | null>>;
  /** Returns the workspace root containing the given directory, or null. */
  findRoot(directory: string): Promise<string | null>;
  create(request: CreateWorkspaceRequest): Promise<WorkspaceSummary>;
  rename(workspacePath: string, newName: string): Promise<void>;
  /** Unregisters the workspace; files on disk are kept. */
  remove(workspacePath: string): Promise<void>;
  /** Downloads the latest changes of the loaded branch. */
  update(workspacePath: string, operationId: string): Promise<void>;
  /** Emits `workspaceChanged` events when the workspace changes on disk. Replaces any previous watch. */
  watch(workspacePath: string): Promise<WatchCoverage>;
  /** Switches to a branch, changeset, label or shelve spec. */
  switchTo(workspacePath: string, targetSpec: string, operationId: string): Promise<void>;
}
