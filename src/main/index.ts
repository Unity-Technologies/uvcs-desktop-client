// First: errors nothing else catches are the app's to report from here on, never Electron's native dialog.
import './errors/installUnexpectedErrorHandlers';
import { join } from 'node:path';
import { app, BrowserWindow } from 'electron';
import { repositoryPlace } from '@shared/domain/place';
import { BranchNamesCache } from './cm/BranchNamesCache';
import { readBranchNames } from './cm/branchNames';
import { CmClient } from './cm/CmClient';
import { locateCm } from './cm/locateCm';
import { warnOnOrganizationIds } from './cm/organizationIds';
import { warnOnRepeatedServerCommands } from './cm/repeatedCommands';
import { findWorkspaceRoot } from './cm/workspaceRoot';
import { apiMethods } from './ipc/apiMethods';
import { EarlyCalls } from './ipc/EarlyCalls';
import { registerApi } from './ipc/registerApi';
import { currentCaller } from './ipc/caller';
import { sendEvent, sendEventTo } from './ipc/sendEvent';
import { DiffReviewStore } from './review/DiffReviewStore';
import { ReviewStore } from './review/ReviewStore';
import { RevisionCat } from './files/RevisionCat';
import { removeLeftOverTempDirectories } from './files/tempFile';
import { WorkspaceCopies } from './files/WorkspaceCopies';
import { createServices } from './services/createServices';
import { RepositoryPathSearch } from './files/RepositoryPathSearch';
import { RepositoryTrees } from './unity/RepositoryTrees';
import { RevisionDownloads } from './unity/RevisionDownloads';
import { CommandLogRelay } from './startup/commandLogRelay';
import { openFirstWindow, readFirstScreenAhead, type FirstScreenRead } from './startup/firstWindow';
import { handleLaunchRequests, isTheRunningApp, launchNamesAFolder } from './startup/launchRequests';
import { receiveLinks, registerAsLinkHandler } from './startup/linkRequests';
import type { LinkRequests } from './links/LinkRequests';
import { trackOperations } from './startup/operationTracking';
import { ignoreOwnCommandWrites } from './startup/ownWrites';
import { handleQuitting, Quitting } from './startup/quitting';
import { openSettings, sendSettingsChanges } from './startup/settings';
import { isShown, watchShownWorkspaces } from './startup/workspaceWatching';
import { createAppUpdates } from './update/createAppUpdates';
import { DEVELOPMENT_DOCK_ICON } from './window/appIcon';
import { appMenuInstaller, installDockMenu } from './window/appMenu';
import { askToCloseWhenDone } from './window/askToCloseWhenDone';
import { askToQuitWhenDone } from './window/askToQuitWhenDone';
import { ClosingWithWrites } from './window/closingWithWrites';
import { followAppTheme } from './window/followAppTheme';
import { HandedOverDiffs } from './window/HandedOverDiffs';
import { showProgressOnAppIcon } from './window/showProgressOnAppIcon';
import { WindowWrites } from './window/WindowWrites';
import { WorkspaceWindows } from './window/WorkspaceWindows';
import { cmHeaderReaders, WorkspaceHeaders } from './workspace/WorkspaceHeaders';

const userData = app.getPath('userData');
// Commands of a repository explored without a workspace run here, where none can be read by mistake (`outsideWorkspaces`).
const cm = new CmClient(locateCm, join(userData, 'outside-workspaces'));
const settings = openSettings(userData);
// What a workspace is loaded from, shared by the reads that follow one another as a window opens it.
const headers = new WorkspaceHeaders(cmHeaderReaders(cm));
// Branch names by id, which code reviews name their branches by (`BranchNamesCache`), kept while a window shows the
// workspace.
const branchNames = new BranchNamesCache(
  (place) => readBranchNames(cm, place),
  Date.now,
  // A repository's names are kept while a window explores it (`windows.explores`); its last window lets them go.
  (place) => (place.kind === 'workspace' ? isShown(watchers, place.workspacePath) : windows.explores(place.repository)),
);
const watchers = watchShownWorkspaces({ cm, headers, branchNames });
const workspaceCopies = new WorkspaceCopies({ cm });
watchers.listen({ changed: (workspacePath, change) => workspaceCopies.forgetChanged(workspacePath, change), unwatched: (workspacePath) => workspaceCopies.forgetListings(workspacePath) });
const revisionCat = new RevisionCat({ cm });
const revisionDownloads = new RevisionDownloads({ cm, copies: workspaceCopies });
const repositoryTrees = new RepositoryTrees({ cm, downloads: revisionDownloads });
const repositoryPaths = new RepositoryPathSearch(cm);
const appIcon = showProgressOnAppIcon();
const windowWrites = new WindowWrites();
const operations = trackOperations(watchers, appIcon, windowWrites);
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
  onRepositoryLeft: (repository) => {
    branchNames.forget(repositoryPlace(repository));
    repositoryPaths.forget(repository);
  },
  onLastWindowClosing: () => quitting.lastWindowClosing(),
  onCloseRequested: (windowId, event) => closing.closeRequested(windowId, event),
});
const closing = new ClosingWithWrites({
  quitting: () => quitting.started(),
  writesRunningIn: (windowId) => windowWrites.runningIn(windows.closingWith(windowId)),
  writesFinishedIn: (windowId) => windowWrites.finishedIn(() => windows.closingWith(windowId)),
  askToCloseWhenDone,
  kept: (windowId) => appIcon.windowKept(windowId),
  close: (windowId) => BrowserWindow.fromId(windowId)?.close(),
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
// A page window has no command log: what it runs shows in its workspace window's.
const commandLog = new CommandLogRelay((entry) => {
  const caller = currentCaller();
  if (caller) sendEventTo(windows.commandLogOf(caller), 'commandLogged', entry);
  else sendEvent('commandLogged', entry);
});
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
  handedOverDiffs: new HandedOverDiffs(),
  headers,
  updates,
  workspaceCopies,
  revisionCat,
  revisionDownloads,
  repositoryTrees,
  repositoryPaths,
  branchNames,
});
const early = new EarlyCalls(apiMethods(api));

function start(launched: Promise<void>, readAhead: FirstScreenRead, links: LinkRequests): void {
  if (!app.isPackaged) app.dock?.setIcon(DEVELOPMENT_DOCK_ICON);
  sendSettingsChanges(settings, (changed) => sendEvent('settingsChanged', changed));
  void revisionDownloads.removeLeftOvers();
  void repositoryPaths.removeLeftOvers();
  void removeLeftOverTempDirectories();
  registerApi(api, early);
  followAppTheme(settings);
  handleQuitting(quitting);
  installDockMenu(windows);
  updates.checkPeriodically();
  registerAsLinkHandler();
  const openFirst = (): void => {
    openFirstWindow({ cm, windows, early, settings, commandLog }, readAhead);
    links.windowsOpened();
  };
  void launched.then(openFirst, openFirst);
  // macOS keeps the app running with no window; clicking the Dock icon then opens the home screen.
  app.on('activate', () => windows.all().length === 0 && windows.open());
}

if (isTheRunningApp()) {
  const launched = handleLaunchRequests(windows, (folder) => findWorkspaceRoot(cm, folder));
  const links = receiveLinks(windows);
  // `cm` doesn't need Electron ready: the first screen's commands run while it gets there.
  const readAhead = readFirstScreenAhead({ cm, windows, early, settings }, launchNamesAFolder());
  void app.whenReady().then(() => start(launched, readAhead, links));
} else {
  app.quit();
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  cm.dispose();
  revisionDownloads.dispose();
  repositoryPaths.dispose();
});
