import type { WorkspaceInfo, WorkspaceSummary } from '../domain/workspace';

export interface CreateWorkspaceRequest {
  name: string;
  path: string;
  repository: string;
}

export interface WorkspacesApi {
  list(): Promise<WorkspaceSummary[]>;
  info(workspacePath: string): Promise<WorkspaceInfo>;
  /**
   * Which repository each workspace works on (`name@server`), or null when it can't be told quickly
   * (missing folder, unreachable server). Costs one `cm` call per workspace, so only the first 10 paths
   * are looked up: pass the few workspaces on screen (e.g. the recent ones), never the whole list.
   * `system.cancelOperation(lookupId)` stops the lookups, e.g. when the list leaves the screen.
   */
  repositoriesOf(workspacePaths: string[], lookupId: string): Promise<Record<string, string | null>>;
  /** The paths whose folder no longer exists on disk. */
  missingFolders(workspacePaths: string[]): Promise<string[]>;
  /** Returns the workspace root containing the given directory, or null. */
  findRoot(directory: string): Promise<string | null>;
  create(request: CreateWorkspaceRequest): Promise<WorkspaceSummary>;
  rename(workspacePath: string, newName: string): Promise<void>;
  /** Unregisters the workspace; files on disk are kept. */
  remove(workspacePath: string): Promise<void>;
  /** Downloads the latest changes of the loaded branch. */
  update(workspacePath: string, operationId: string): Promise<void>;
  /** Emits `workspaceChanged` events when files change on disk. Replaces any previous watch. */
  watch(workspacePath: string): Promise<void>;
  /** Switches to a branch, changeset, label or shelve spec. */
  switchTo(workspacePath: string, targetSpec: string, operationId: string): Promise<void>;
}
