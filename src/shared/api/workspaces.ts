import type { WorkspaceInfo, WorkspaceSummary } from '../domain/workspace';

export interface CreateWorkspaceRequest {
  name: string;
  path: string;
  repository: string;
}

export interface WorkspacesApi {
  list(): Promise<WorkspaceSummary[]>;
  info(workspacePath: string): Promise<WorkspaceInfo>;
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
