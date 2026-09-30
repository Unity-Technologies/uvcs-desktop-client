import { app } from 'electron';
import { handleRecentDocumentRequests } from '../window/recentDocuments';
import { workspaceArgument } from '../window/workspaceArgument';
import type { WorkspaceWindows } from '../window/WorkspaceWindows';

/** The root of the workspace holding a folder; null outside any workspace (`findWorkspaceRoot`). */
type FindWorkspaceRoot = (folder: string) => Promise<string | null>;

/** How this process was launched: its command line and the folder it was run in. */
interface Launch {
  argv: readonly string[];
  workingDirectory: string;
}

/**
 * One running app per user: a later launch hands its request to this one and quits. Development builds skip this so
 * several instances (e.g. automated UI checks) can run side by side. Whether this process is the app that runs.
 */
export function isTheRunningApp(): boolean {
  return !app.isPackaged || app.requestSingleInstanceLock();
}

/**
 * Opens what a launch of the app asks for: the workspace holding the folder this launch or a later one names (a later
 * launch naming none brings the app forward), and one picked from the Dock's recent workspaces. Called before the app
 * is ready, as that request may be what launched it. Settles once this launch's own request is known: the first window
 * waits for it (`openFirst`), as `cm` may find the workspace after Electron is ready.
 */
export async function handleLaunchRequests(
  windows: WorkspaceWindows,
  findRoot: FindWorkspaceRoot,
  launch: Launch = { argv: process.argv, workingDirectory: process.cwd() },
): Promise<void> {
  app.on('second-instance', (_event, argv, workingDirectory) => openLaterLaunchRequest(windows, findRoot, { argv, workingDirectory }));
  handleRecentDocumentRequests(windows);
  const folder = namedFolder(launch);
  const root = folder && (await findRoot(folder));
  // Not ready yet as far as the windows go: the first window takes it.
  if (root) windows.requestWorkspace(root, false);
}

function openLaterLaunchRequest(windows: WorkspaceWindows, findRoot: FindWorkspaceRoot, launch: Launch): void {
  const folder = namedFolder(launch);
  if (!folder) {
    windows.focusAny();
    return;
  }
  void findRoot(folder).then((root) => {
    if (root) windows.requestWorkspace(root, app.isReady());
    else if (app.isReady()) windows.focusAny();
  });
}

/** The folder a launch of the installed app names: Windows and Linux pass it as an argument, macOS as `open-file`. */
function namedFolder({ argv, workingDirectory }: Launch): string | null {
  return app.isPackaged ? workspaceArgument(argv, workingDirectory) : null;
}
