import { join } from 'node:path';
import { app, BrowserWindow } from 'electron';
import { CmClient } from './cm/CmClient';
import { locateCm } from './cm/locateCm';
import { registerApi } from './ipc/registerApi';
import { sendEvent } from './ipc/sendEvent';
import { OperationTracker } from './operations/OperationTracker';
import { createServices } from './services/createServices';
import { SettingsStore } from './settings/SettingsStore';
import { WorkspaceWatcher } from './watch/WorkspaceWatcher';
import { installAppMenu } from './window/appMenu';
import { createMainWindow } from './window/createMainWindow';
import { handleRecentDocumentRequests } from './window/recentDocuments';

const cm = new CmClient(locateCm());

function start(): void {
  cm.warmUp();
  cm.onCommandLogged((entry) => sendEvent('commandLogged', entry));
  const settings = new SettingsStore(join(app.getPath('userData'), 'settings.json'));

  registerApi(
    createServices({
      cm,
      operations: new OperationTracker((operationId, line) => sendEvent('operationProgress', { operationId, line })),
      settings,
      watcher: new WorkspaceWatcher((workspacePath, pathsChanged) => sendEvent('workspaceChanged', { workspacePath, pathsChanged })),
    }),
  );

  installAppMenu();
  createMainWindow(settings);
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow(settings);
  });
}

// One running app per user: a second launch focuses the existing window. Development builds skip
// this so several instances (e.g. automated UI checks) can run side by side.
if (app.isPackaged && !app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', focusMainWindow);
  // Registered before the app is ready: opening a recent workspace from the Dock can be what launches it.
  handleRecentDocumentRequests();
  app.whenReady().then(start);
}

function focusMainWindow(): void {
  const window = BrowserWindow.getAllWindows()[0];
  if (!window) return;
  if (window.isMinimized()) window.restore();
  window.focus();
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => cm.dispose());
