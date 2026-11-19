import { app } from 'electron';
import { isLinkLaunch } from '../links/linkArgument';
import { handleRecentDocumentRequests } from '../window/recentDocuments';
import { workspaceArgument } from '../window/workspaceArgument';
import type { WorkspaceWindows } from '../window/WorkspaceWindows';

/** The root of the workspace holding a folder; null outside any workspace (`findWorkspaceRoot`). */
type FindWorkspaceRoot = (folder: string) => Promise<string | null>;

/**
 * Whether `cm` can run (`CmRuntime`): finding a folder's workspace asks it, so while the app's own `cm` is set up the
 * lookup waits for it.
 */
export interface CmReadiness {
  isReady(): boolean;
  whenReady(): Promise<void>;
}

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
 * waits for it (`openFirst`), as `cm` may find the workspace after Electron is ready; but not for the app's own `cm`
 * being set up, which the window shows meanwhile.
 */
export async function handleLaunchRequests(
  windows: WorkspaceWindows,
  findRoot: FindWorkspaceRoot,
  cm: CmReadiness,
  launch: Launch = { argv: process.argv, workingDirectory: process.cwd() },
): Promise<void> {
  const findWhenReady: FindWorkspaceRoot = (folder) => cm.whenReady().then(() => findRoot(folder));
  app.on('second-instance', (_event, argv, workingDirectory) => openLaterLaunchRequest(windows, findWhenReady, { argv, workingDirectory }));
  handleRecentDocumentRequests(windows);
  const folder = namedFolder(launch);
  if (!folder) return;
  if (!cm.isReady()) {
    // The first window opens on the setup at once; the folder's workspace opens in it once `cm` can find it.
    void findWhenReady(folder).then((root) => root && windows.requestWorkspace(root));
    return;
  }
  const root = await findRoot(folder);
  if (root) windows.requestAtLaunch(root);
}

/**
 * Whether this launch names a folder on its command line (Windows, Linux), known as the main module loads, before
 * `cm` finds the workspace holding it: the first window may then open another workspace than the last one used
 * (`readFirstScreenAhead`). macOS names it later, in `open-file`.
 */
export function launchNamesAFolder(launch: Launch = { argv: process.argv, workingDirectory: process.cwd() }): boolean {
  return namedFolder(launch) !== null;
}

/** A later launch's folder, or the app brought forward; a later launch for a link is `receiveLinks`'s. */
function openLaterLaunchRequest(windows: WorkspaceWindows, findRoot: FindWorkspaceRoot, launch: Launch): void {
  if (isLinkLaunch(launch.argv)) return;
  const folder = namedFolder(launch);
  if (!folder) {
    windows.focusAny();
    return;
  }
  void findRoot(folder).then((root) => {
    if (root) windows.requestWorkspace(root);
    else if (app.isReady()) windows.focusAny();
  });
}

/** The folder a launch of the installed app names: Windows and Linux pass it as an argument, macOS as `open-file`. */
function namedFolder({ argv, workingDirectory }: Launch): string | null {
  return app.isPackaged ? workspaceArgument(argv, workingDirectory) : null;
}
