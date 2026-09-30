import { app } from 'electron';
import { handleRecentDocumentRequests } from '../window/recentDocuments';
import { workspaceArgument } from '../window/workspaceArgument';
import type { WorkspaceWindows } from '../window/WorkspaceWindows';

/** The root of the workspace holding a folder; null outside any workspace (`findWorkspaceRoot`). */
type FindWorkspaceRoot = (folder: string) => Promise<string | null>;

/**
 * One running app per user: a later launch hands its request to this one and quits. Development builds skip this so
 * several instances (e.g. automated UI checks) can run side by side. Whether this process is the app that runs.
 */
export function isTheRunningApp(): boolean {
  return !app.isPackaged || app.requestSingleInstanceLock();
}

/**
 * Opens what a launch of the app asks for: the workspace named by this launch or a later one (a second launch focuses
 * the app when it names none), and one picked from the Dock's recent workspaces. Called before the app is ready, as
 * that request may be what launched it.
 */
export function handleLaunchRequests(windows: WorkspaceWindows, findRoot: FindWorkspaceRoot): void {
  app.on('second-instance', (_event, argv, workingDirectory) => {
    if (!openNamedWorkspace(windows, findRoot, argv, workingDirectory)) windows.focusAny();
  });
  handleRecentDocumentRequests(windows);
  openNamedWorkspace(windows, findRoot, process.argv, process.cwd());
}

/**
 * Opens the workspace holding the folder a launch of the installed app names (Windows and Linux pass it as an
 * argument; macOS as `open-file`). Whether it named one.
 */
function openNamedWorkspace(windows: WorkspaceWindows, findRoot: FindWorkspaceRoot, argv: readonly string[], workingDirectory: string): boolean {
  const folder = app.isPackaged ? workspaceArgument(argv, workingDirectory) : null;
  if (!folder) return false;
  void findRoot(folder).then((root) => {
    if (root) windows.requestWorkspace(root, app.isReady());
    else if (app.isReady()) windows.focusAny();
  });
  return true;
}
