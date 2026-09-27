import { app } from 'electron';
import type { WorkspaceWindows } from './WorkspaceWindows';

/**
 * Workspaces are the app's documents: they show in the Dock menu's recent list on macOS (Windows lists in a jump list
 * only file types an app handles, never folders; Linux has no such list). Picking one there comes back as
 * `open-file`, also when it launches the app. Windows and Linux name a folder to open as an argument (`index.ts`).
 */
export function handleRecentDocumentRequests(windows: WorkspaceWindows): void {
  app.on('open-file', (event, path) => {
    event.preventDefault();
    windows.requestWorkspace(path, app.isReady());
  });
}
