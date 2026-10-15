// First: errors nothing else catches are the app's to report from here on, never Electron's native dialog.
import './errors/installUnexpectedErrorHandlers';
import { join } from 'node:path';
import { app } from 'electron';
import { CmClient } from './cm/CmClient';
import { locateCm } from './cm/locateCm';
import { warnOnOrganizationIds } from './cm/organizationIds';
import { warnOnRepeatedServerCommands } from './cm/repeatedCommands';
import { findWorkspaceRoot } from './cm/workspaceRoot';
import { apiMethods } from './ipc/apiMethods';
import { EarlyCalls } from './ipc/EarlyCalls';
import { registerApi } from './ipc/registerApi';
import { sendEvent, sendEventToCaller } from './ipc/sendEvent';
import { DiffReviewStore } from './review/DiffReviewStore';
import { ReviewStore } from './review/ReviewStore';
import { WorkspaceCopies } from './files/WorkspaceCopies';
import { createServices } from './services/createServices';
import { RepositoryTrees } from './unity/RepositoryTrees';
import { RevisionDownloads } from './unity/RevisionDownloads';
import { CommandLogRelay } from './startup/commandLogRelay';
import { openFirstWindow, readFirstScreenAhead, type FirstScreenRead } from './startup/firstWindow';
import { handleLaunchRequests, isTheRunningApp, launchNamesAFolder } from './startup/launchRequests';
import { trackOperations } from './startup/operationTracking';
import { ignoreOwnCommandWrites } from './startup/ownWrites';
import { handleQuitting, Quitting } from './startup/quitting';
import { openSettings, sendSettingsChanges } from './startup/settings';
import { watchShownWorkspaces } from './startup/workspaceWatching';
import { createAppUpdates } from './update/createAppUpdates';
import { DEVELOPMENT_DOCK_ICON } from './window/appIcon';
import { appMenuInstaller, installDockMenu } from './window/appMenu';
import { askToQuitWhenDone } from './window/askToQuitWhenDone';
import { followAppTheme } from './window/followAppTheme';
import { WorkspaceWindows } from './window/WorkspaceWindows';
import { cmHeaderReaders, WorkspaceHeaders } from './workspace/WorkspaceHeaders';

const userData = app.getPath('userData');
const cm = new CmClient(locateCm);
const settings = openSettings(userData);
// What a workspace is loaded from, shared by the reads that follow one another as a window opens it.
const headers = new WorkspaceHeaders(cmHeaderReaders(cm));
const watchers = watchShownWorkspaces(cm, headers);
const workspaceCopies = new WorkspaceCopies({ cm });
watchers.listen({ changed: (workspacePath, change) => workspaceCopies.forgetChanged(workspacePath, change), unwatched: (workspacePath) => workspaceCopies.forgetListings(workspacePath) });
const revisionDownloads = new RevisionDownloads({ cm, copies: workspaceCopies });
const repositoryTrees = new RepositoryTrees({ cm, downloads: revisionDownloads });
const operations = trackOperations(watchers);
const updates = createAppUpdates({
  writesRunning: () => operations.writesRunning(),
  writesFinished: () => operations.writesFinished(),
  beforeRestart: () => quitting.restartToInstall(),
});
const windows = new WorkspaceWindows({
  settings,
  workspaceOf: (viewer) => watchers.workspaceOf(viewer),
  onWindowsChanged: () => app.isReady() && installMenuBar(),
  onClosed: (viewer) => watchers.release(viewer),
  onLastWindowClosing: () => quitting.lastWindowClosing(),
});
const installMenuBar = appMenuInstaller(windows, updates);
const quitting = new Quitting({
  writesRunning: () => operations.writesRunning(),
  writesFinished: () => operations.writesFinished(),
  askToQuitWhenDone,
  hasWindows: () => windows.all().length > 0,
  quitsWithLastWindow: process.platform !== 'darwin',
  saveSession: (options) => windows.saveSession(options),
  quit: () => app.quit(),
});

// Every command `cm` runs is logged and watched from here on, as the first screen's reads start before Electron is
// ready. A window sees the commands its own calls ran (commands run outside any call go to every window).
const commandLog = new CommandLogRelay((entry) => sendEventToCaller('commandLogged', entry));
cm.onCommandLogged((entry) => commandLog.logged(entry));
if (!app.isPackaged) warnOnRepeatedServerCommands(cm);
if (!app.isPackaged) warnOnOrganizationIds(cm);
ignoreOwnCommandWrites(cm, watchers, headers);
const api = createServices({
  cm,
  operations,
  reviews: new ReviewStore(join(userData, 'review-snapshots')),
  diffReviews: new DiffReviewStore(join(userData, 'review-snapshots', 'diffs')),
  settings,
  watchers,
  windows,
  headers,
  updates,
  workspaceCopies,
  revisionDownloads,
  repositoryTrees,
});
const early = new EarlyCalls(apiMethods(api));

function start(launched: Promise<void>, readAhead: FirstScreenRead): void {
  if (!app.isPackaged) app.dock?.setIcon(DEVELOPMENT_DOCK_ICON);
  sendSettingsChanges(settings, (changed) => sendEvent('settingsChanged', changed));
  void revisionDownloads.removeLeftOvers();
  registerApi(api, early);
  followAppTheme(settings);
  handleQuitting(quitting);
  installDockMenu(windows);
  updates.checkPeriodically();
  const openFirst = (): void => openFirstWindow({ cm, windows, early, settings, commandLog }, readAhead);
  void launched.then(openFirst, openFirst);
  // macOS keeps the app running with no window; clicking the Dock icon then opens the home screen.
  app.on('activate', () => windows.all().length === 0 && windows.open());
}

if (isTheRunningApp()) {
  const launched = handleLaunchRequests(windows, (folder) => findWorkspaceRoot(cm, folder));
  // `cm` doesn't need Electron ready: the first screen's commands run while it gets there.
  const readAhead = readFirstScreenAhead({ cm, windows, early, settings }, launchNamesAFolder());
  void app.whenReady().then(() => start(launched, readAhead));
} else {
  app.quit();
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  cm.dispose();
  revisionDownloads.dispose();
});
