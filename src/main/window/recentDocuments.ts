import { app } from 'electron';
import type { WorkspaceWindows } from './WorkspaceWindows';

/**
 * Workspaces are the app's documents: they show in the OS recent list (the Dock menu on macOS, the jump list
 * on Windows). Picking one there comes back as `open-file`, also when it launches the app.
 */
export function handleRecentDocumentRequests(windows: WorkspaceWindows): void {
  app.on('open-file', (event, path) => {
    event.preventDefault();
    windows.requestWorkspace(path, app.isReady());
  });
}
