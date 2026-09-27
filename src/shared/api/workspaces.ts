import type { PendingChangesAction, SwitchPreflight, SwitchResult } from '../domain/switchWithChanges';
import type { NewFolderCheck, WorkspaceGlance, WorkspaceHead, WorkspaceInfo, WorkspaceSelector, WorkspaceSummary } from '../domain/workspace';

export interface CreateWorkspaceRequest {
  name: string;
  path: string;
  repository: string;
}

/**
 * How much of a workspace the watcher sees. `full`: every change on disk. `partial` (a recursive watch failed, or a
 * Linux tree past the folders it can watch one by one): some folders only, so edits elsewhere need another refresh trigger.
 */
export type WatchCoverage = 'full' | 'partial';

export interface WorkspacesApi {
  list(): Promise<WorkspaceSummary[]>;
  info(workspacePath: string): Promise<WorkspaceInfo>;
  /** The comment of the branch, changeset, label or shelve the workspace is loaded from; empty if it has none. */
  workingObjectComment(workspacePath: string, selector: WorkspaceSelector): Promise<string>;
  /**
   * Which repository each workspace works on (`name@server`), or null when it can't be told quickly
   * (missing folder, unreachable server). Costs one `cm` call per workspace, so only the first 10 paths
   * are looked up: pass the few workspaces on screen (e.g. the recent ones), never the whole list.
   * `system.cancelOperation(lookupId)` stops the lookups, e.g. when the list leaves the screen.
   */
  repositoriesOf(workspacePaths: string[], lookupId: string): Promise<Record<string, string | null>>;
  /**
   * The repository and branch (or changeset, label, shelve) of each workspace, read from its `.plastic` folder: no `cm`
   * call, cheap enough for every listed workspace. Workspaces whose folder can't tell are left out.
   */
  heads(workspacePaths: string[]): Promise<Record<string, WorkspaceHead>>;
  /** The paths whose folder doesn't exist (deleted, moved, or on a drive that isn't mounted). No `cm` call. */
  findMissing(paths: string[]): Promise<string[]>;
  /** Returns the workspace root containing the given directory, or null. A workspace moved on disk is re-registered at its new place. */
  findRoot(directory: string): Promise<string | null>;
  create(request: CreateWorkspaceRequest): Promise<WorkspaceSummary>;
  rename(workspacePath: string, newName: string): Promise<void>;
  /** Unregisters the workspace; files on disk are kept. */
  remove(workspacePath: string): Promise<void>;
  /** Downloads the latest changes of the loaded branch. */
  update(workspacePath: string, operationId: string): Promise<void>;
  /**
   * The calling window now shows this workspace: it gets `workspaceChanged` events when the workspace changes on
   * disk, instead of the ones of the workspace it showed before. Windows showing the same workspace share a watcher.
   */
  watch(workspacePath: string): Promise<WatchCoverage>;
  /** The calling window shows no workspace anymore (back to the home screen). */
  unwatch(): Promise<void>;
  /**
   * What another workspace is loaded from and how many pending changes it has: one local `cm status` (it reads the
   * workspace on disk, never the server). For a few workspaces on screen, e.g. while the switcher is open.
   */
  glance(workspacePath: string): Promise<WorkspaceGlance>;
  /** Whether a new workspace can go in this folder. No `cm` call. */
  checkNewFolder(path: string): Promise<NewFolderCheck>;
  /** Loads `targetSpec` in a workspace just created (nothing pending, nothing loaded): a plain `cm switch`. */
  switchNewWorkspace(workspacePath: string, targetSpec: string, operationId: string): Promise<void>;
  /**
   * Undoes the creation of a workspace that failed halfway: unregisters it, and deletes its folder when `create`
   * made it (it didn't exist or was empty), so nothing of the user's goes.
   */
  discardNew(workspacePath: string): Promise<void>;
  /** What the workspace's pending changes allow before switching it to `targetSpec`. */
  switchPreflight(workspacePath: string, targetSpec: string): Promise<SwitchPreflight>;
  /**
   * Switches to a branch, changeset, label or shelve spec. `cm switch` only ever runs on a clean workspace:
   * pending changes are shelved first, then left behind or brought along as `pendingChanges` says.
   * Unchanged checkouts are simply undone. Fails if there are other pending changes and no `pendingChanges`.
   */
  switchTo(workspacePath: string, targetSpec: string, operationId: string, pendingChanges?: PendingChangesAction): Promise<SwitchResult>;
}
