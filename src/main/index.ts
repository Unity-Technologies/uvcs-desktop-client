import { join } from 'node:path';
import { app } from 'electron';
import { CmClient } from './cm/CmClient';
import { locateCm } from './cm/locateCm';
import { warnOnRepeatedServerCommands } from './cm/repeatedCommands';
import { findWorkspaceRoot } from './cm/workspaceRoot';
import { registerApi } from './ipc/registerApi';
import { sendEvent, sendEventToCaller } from './ipc/sendEvent';
import { DiffReviewStore } from './review/DiffReviewStore';
import { ReviewStore } from './review/ReviewStore';
import { createServices } from './services/createServices';
import { handleLaunchRequests, isTheRunningApp } from './startup/launchRequests';
import { trackOperations } from './startup/operationTracking';
import { ignoreOwnCommandWrites } from './startup/ownWrites';
import { openSettings, sendSettingsChanges } from './startup/settings';
import { watchShownWorkspaces } from './startup/workspaceWatching';
import { installAppMenu, installMenus } from './window/appMenu';
import { followAppTheme } from './window/followAppTheme';
import { WorkspaceWindows } from './window/WorkspaceWindows';
import { cmHeaderReaders, WorkspaceHeaders } from './workspace/WorkspaceHeaders';

const userData = app.getPath('userData');
const cm = new CmClient(locateCm);
const settings = openSettings(userData);
// What a workspace is loaded from, shared by the reads that follow one another as a window opens it.
const headers = new WorkspaceHeaders(cmHeaderReaders(cm));
const watchers = watchShownWorkspaces(cm, headers);
const windows = new WorkspaceWindows({
  settings,
  workspaceOf: (viewer) => watchers.workspaceOf(viewer),
  onWindowsChanged: () => app.isReady() && installAppMenu(windows),
  onClosed: (viewer) => watchers.release(viewer),
});

function start(): void {
  cm.warmUp();
  // A window sees the commands its own calls ran (commands run outside any call go to every window).
  cm.onCommandLogged((entry) => sendEventToCaller('commandLogged', entry));
  if (!app.isPackaged) warnOnRepeatedServerCommands(cm);
  sendSettingsChanges(settings, (changed) => sendEvent('settingsChanged', changed));
  ignoreOwnCommandWrites(cm, watchers, headers);
  registerApi(
    createServices({
      cm,
      operations: trackOperations(watchers),
      reviews: new ReviewStore(join(userData, 'review-snapshots')),
      diffReviews: new DiffReviewStore(join(userData, 'review-snapshots', 'diffs')),
      settings,
      watchers,
      windows,
      headers,
    }),
  );
  followAppTheme(settings);
  installMenus(windows);
  windows.openFirst();
  // macOS keeps the app running with no window; clicking the Dock icon then opens the home screen.
  app.on('activate', () => windows.all().length === 0 && windows.open());
}

if (isTheRunningApp()) {
  handleLaunchRequests(windows, (folder) => findWorkspaceRoot(cm, folder));
  app.whenReady().then(start);
} else {
  app.quit();
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => cm.dispose());
