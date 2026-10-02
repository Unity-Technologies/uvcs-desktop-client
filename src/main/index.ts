// First: errors nothing else catches are the app's to report from here on, never Electron's native dialog.
import './errors/installUnexpectedErrorHandlers';
import { join } from 'node:path';
import { app } from 'electron';
import { CmClient } from './cm/CmClient';
import { locateCm } from './cm/locateCm';
import { warnOnRepeatedServerCommands } from './cm/repeatedCommands';
import { findWorkspaceRoot } from './cm/workspaceRoot';
import { apiMethods } from './ipc/apiMethods';
import { EarlyCalls } from './ipc/EarlyCalls';
import { registerApi } from './ipc/registerApi';
import { sendEvent, sendEventToCaller } from './ipc/sendEvent';
import { DiffReviewStore } from './review/DiffReviewStore';
import { ReviewStore } from './review/ReviewStore';
import { createServices } from './services/createServices';
import { openFirstWindow } from './startup/firstWindow';
import { handleLaunchRequests, isTheRunningApp } from './startup/launchRequests';
import { trackOperations } from './startup/operationTracking';
import { handleQuitting, Quitting } from './startup/quitting';
import { ignoreOwnCommandWrites } from './startup/ownWrites';
import { openSettings, sendSettingsChanges } from './startup/settings';
import { watchShownWorkspaces } from './startup/workspaceWatching';
import { createAppUpdates } from './update/createAppUpdates';
import { DEVELOPMENT_DOCK_ICON } from './window/appIcon';
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
const updates = createAppUpdates();
const windows = new WorkspaceWindows({
  settings,
  workspaceOf: (viewer) => watchers.workspaceOf(viewer),
  onWindowsChanged: () => app.isReady() && installAppMenu(windows, updates),
  onClosed: (viewer) => watchers.release(viewer),
});

function start(launched: Promise<void>): void {
  // A window sees the commands its own calls ran (commands run outside any call go to every window).
  cm.onCommandLogged((entry) => sendEventToCaller('commandLogged', entry));
  if (!app.isPackaged) warnOnRepeatedServerCommands(cm);
  if (!app.isPackaged) app.dock?.setIcon(DEVELOPMENT_DOCK_ICON);
  sendSettingsChanges(settings, (changed) => sendEvent('settingsChanged', changed));
  ignoreOwnCommandWrites(cm, watchers, headers);
  const api = createServices({
    cm,
    operations: trackOperations(watchers),
    reviews: new ReviewStore(join(userData, 'review-snapshots')),
    diffReviews: new DiffReviewStore(join(userData, 'review-snapshots', 'diffs')),
    settings,
    watchers,
    windows,
    headers,
    updates,
  });
  const early = new EarlyCalls(apiMethods(api));
  registerApi(api, early);
  followAppTheme(settings);
  handleQuitting(new Quitting());
  installMenus(windows, updates);
  updates.checkPeriodically();
  const openFirst = (): void => openFirstWindow({ cm, windows, early, settings });
  void launched.then(openFirst, openFirst);
  // macOS keeps the app running with no window; clicking the Dock icon then opens the home screen.
  app.on('activate', () => windows.all().length === 0 && windows.open());
}

if (isTheRunningApp()) {
  const launched = handleLaunchRequests(windows, (folder) => findWorkspaceRoot(cm, folder));
  void app.whenReady().then(() => start(launched));
} else {
  app.quit();
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => cm.dispose());
