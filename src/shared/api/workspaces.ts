import type { SwitchChangesAction, SwitchPreflight, SwitchResult } from '../domain/switchWithChanges';
import type { NewFolderCheck, WorkspaceGlance, WorkspaceHead, WorkspaceInfo, WorkspaceKind, WorkspaceLocation, WorkspaceSelector, WorkspaceSummary } from '../domain/workspace';

export interface CreateWorkspaceRequest {
  name: string;
  path: string;
  repository: string;
  /**
   * How it holds its files; standard when not given. A dynamic workspace fetches its files from the server as they're
   * opened, instead of downloading them with an update: only where `canCreateDynamic` says so.
   */
  kind?: WorkspaceKind;
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
   * Which repository a workspace works on (`name@server`), or null when it can't be told quickly (missing folder,
   * unreachable server). Costs one `cm` call, two at a time across calls: ask about the few workspaces on screen (the
   * recent ones), never the whole list. `system.cancelOperation(lookupId)` stops it, e.g. when the list leaves the screen.
   */
  repositoryOf(workspacePath: string, lookupId: string): Promise<string | null>;
  /**
   * The repository and branch (or changeset, label, shelve) of each workspace, from one local `cm wi` each (no server
   * call), cheap enough for every listed workspace. Workspaces `cm` can't tell (a folder that is gone) are left out.
   */
  heads(workspacePaths: string[]): Promise<Record<string, WorkspaceHead>>;
  /**
   * How each workspace holds its files (standard, partial or dynamic), from one local `cm getworkspacefrompath` each,
   * taking turns with `heads`. A workspace's kind is set when it is created, so it is asked once. Workspaces `cm`
   * can't tell are left out.
   */
  kinds(workspacePaths: string[]): Promise<Record<string, WorkspaceKind>>;
  /** The paths whose folder doesn't exist (deleted, moved, or on a drive that isn't mounted). No `cm` call. */
  findMissing(paths: string[]): Promise<string[]>;
  /** Returns the workspace root containing the given directory, or null. A workspace moved on disk is re-registered at its new place. */
  findRoot(directory: string): Promise<string | null>;
  /**
   * The workspace holding a file or folder, and the item's path in it (forward slashes, '' for the root), with links
   * followed on both sides (macOS's `/tmp`, a junction, a linked home): what a workspace link names. One local
   * `cm getworkspacefrompath`; null outside any workspace.
   */
  locate(path: string): Promise<WorkspaceLocation | null>;
  /**
   * Whether dynamic workspaces can be created here: on Windows, while the Unity Version Control tray runs, since its
   * file system serves their files. One local process listing, no `cm` call.
   */
  canCreateDynamic(): Promise<boolean>;
  /**
   * Creates a workspace on /main. A dynamic one is mounted before this answers, ready to open, with nothing to update;
   * a partial one has nothing loaded until `configurePartial` loads what the user chooses.
   */
  create(request: CreateWorkspaceRequest): Promise<WorkspaceSummary>;
  rename(workspacePath: string, newName: string): Promise<void>;
  /** Unregisters the workspace; files on disk are kept. */
  remove(workspacePath: string): Promise<void>;
  /** Downloads the latest changes of the loaded branch. */
  update(workspacePath: string, operationId: string): Promise<void>;
  /**
   * The calling window now shows this workspace: it gets `workspaceChanged` events when the workspace changes on
   * disk, instead of the ones of the workspace it showed before. Windows showing the same workspace share a watcher.
   * Answers once the watch has started (on Linux, once every folder has its watch), with how much it sees.
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
   * Loads `folders` (paths from the repository's root, such as `Assets`) and everything below them in a partial
   * workspace: they download as they're configured, so no update follows.
   */
  configurePartial(workspacePath: string, folders: string[], operationId: string): Promise<void>;
  /**
   * Undoes the creation of a workspace that failed halfway: unregisters it, and deletes its folder when `create`
   * made it (it didn't exist or was empty), so nothing of the user's goes.
   */
  discardNew(workspacePath: string): Promise<void>;
  /** What the workspace's pending changes allow before switching it to `targetSpec`. */
  switchPreflight(workspacePath: string, targetSpec: string): Promise<SwitchPreflight>;
  /**
   * Switches to a branch, changeset, label or shelve spec. `cm switch` only ever runs on a clean workspace:
   * pending changes are shelved first, then left behind or brought along, or undone and lost, as `pendingChanges` says.
   * Unchanged checkouts are simply undone. Fails if there are other pending changes and no `pendingChanges`.
   */
  switchTo(workspacePath: string, targetSpec: string, operationId: string, pendingChanges?: SwitchChangesAction): Promise<SwitchResult>;
}
