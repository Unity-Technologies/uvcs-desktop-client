import { join } from 'node:path';
import { app, BrowserWindow } from 'electron';
import { CmClient } from './cm/CmClient';
import { locateCm } from './cm/locateCm';
import { registerApi } from './ipc/registerApi';
import { sendEvent } from './ipc/sendEvent';
import { OperationTracker } from './operations/OperationTracker';
import { createServices } from './services/createServices';
import { SettingsStore } from './settings/SettingsStore';
import { changesWorkspace } from './watch/changesWorkspace';
import { WorkspaceWatcher } from './watch/WorkspaceWatcher';
import { installAppMenu } from './window/appMenu';
import { createMainWindow } from './window/createMainWindow';

const cm = new CmClient(locateCm());

function start(): void {
  cm.warmUp();
  cm.onCommandLogged((entry) => sendEvent('commandLogged', entry));

  // The renderer refreshes its views after its own operations and writes; the watcher skips what they cause.
  const watcher = new WorkspaceWatcher((workspacePath, change) => sendEvent('workspaceChanged', { workspacePath, ...change }));
  cm.onCommandStarted(({ args, cwd, finished }) => changesWorkspace(args) && watcher.ignoreOwnWrite(finished, cwd));
  const operations = new OperationTracker(
    (operationId, line) => sendEvent('operationProgress', { operationId, line }),
    (finished) => watcher.ignoreOwnWrite(finished),
  );

  registerApi(
    createServices({
      cm,
      operations,
      settings: new SettingsStore(join(app.getPath('userData'), 'settings.json')),
      watcher,
    }),
  );

  installAppMenu();
  createMainWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
}

// One running app per user: a second launch focuses the existing window. Development builds skip
// this so several instances (e.g. automated UI checks) can run side by side.
if (app.isPackaged && !app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', focusMainWindow);
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
