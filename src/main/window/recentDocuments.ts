import { app, BrowserWindow } from 'electron';
import { sendEvent } from '../ipc/sendEvent';

let requestedWorkspace: string | null = null;

/**
 * Workspaces are the app's documents: they show in the OS recent list (the Dock menu on macOS, the jump list
 * on Windows). Picking one there comes back as `open-file`, also when it launches the app, so the request is
 * kept until the renderer takes it.
 */
export function handleRecentDocumentRequests(): void {
  app.on('open-file', (event, path) => {
    event.preventDefault();
    requestedWorkspace = path;
    sendEvent('workspaceOpenRequested', {});
    BrowserWindow.getAllWindows()[0]?.focus();
  });
}

export function takeRequestedWorkspace(): string | null {
  const path = requestedWorkspace;
  requestedWorkspace = null;
  return path;
}
