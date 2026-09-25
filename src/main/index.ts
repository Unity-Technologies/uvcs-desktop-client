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

const cm = new CmClient(locateCm());

function start(): void {
  cm.onCommandLogged((entry) => sendEvent('commandLogged', entry));

  registerApi(
    createServices({
      cm,
      operations: new OperationTracker((operationId, line) => sendEvent('operationProgress', { operationId, line })),
      settings: new SettingsStore(join(app.getPath('userData'), 'settings.json')),
      watcher: new WorkspaceWatcher((workspacePath) => sendEvent('workspaceChanged', { workspacePath })),
    }),
  );

  installAppMenu();
  createMainWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
}

app.whenReady().then(start);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => cm.dispose());
