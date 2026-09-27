import { join } from 'node:path';
import { app, webContents } from 'electron';
import { CmClient } from './cm/CmClient';
import { locateCm } from './cm/locateCm';
import { warnOnRepeatedServerCommands } from './cm/repeatedCommands';
import { currentCaller } from './ipc/caller';
import { registerApi } from './ipc/registerApi';
import { sendEvent, sendEventTo, sendEventToCaller } from './ipc/sendEvent';
import { OperationTracker } from './operations/OperationTracker';
import { DiffReviewStore } from './review/DiffReviewStore';
import { ReviewStore } from './review/ReviewStore';
import { createServices } from './services/createServices';
import { SettingsStore } from './settings/SettingsStore';
import { changesWorkspace, rewritesChangelists } from './watch/changesWorkspace';
import { WorkspaceWatchers } from './watch/WorkspaceWatchers';
import { installAppMenu } from './window/appMenu';
import { followAppTheme } from './window/followAppTheme';
import { handleRecentDocumentRequests } from './window/recentDocuments';
import { WorkspaceWindows } from './window/WorkspaceWindows';
import { cmHeaderReaders, WorkspaceHeaders } from './workspace/WorkspaceHeaders';

const cm = new CmClient(locateCm);
const settings = new SettingsStore(join(app.getPath('userData'), 'settings.json'));
// Rewriting a workspace, by the app or any tool, forgets what was read of it.
const headers = new WorkspaceHeaders(cmHeaderReaders(cm));

// Each window shows one workspace; windows on the same workspace share its watcher and its `cm shell` sessions.
const watchers = new WorkspaceWatchers(
  (viewers, workspacePath, change) => {
    if (change.metadata) headers.forget(workspacePath);
    for (const viewer of viewers) {
      const target = webContents.fromId(viewer);
      if (target) sendEventTo(target, 'workspaceChanged', { workspacePath, ...change });
    }
  },
  (workspacePath) => cm.release(workspacePath),
);
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
  // Window bounds are saved as windows move; no window shows them.
  settings.onChanged((changed, changes) => Object.keys(changes).some((key) => key !== 'windowBounds') && sendEvent('settingsChanged', changed));

  // The renderer refreshes its views after its own operations and writes; the watchers skip what they cause.
  cm.onCommandStarted(({ args, cwd, finished }) => {
    if (rewritesChangelists(args)) watchers.ignoreOwnWrite(finished, cwd, 'changelists');
    if (!changesWorkspace(args)) return;
    watchers.ignoreOwnWrite(finished, cwd);
    headers.forget();
    const forget = () => headers.forget();
    void finished.then(forget, forget);
  });
  const operations = new OperationTracker(
    (operationId, progress) => sendEventToCaller('operationProgress', { operationId, progress }),
    (finished) => {
      const caller = currentCaller();
      watchers.ignoreOwnWrite(finished, caller && watchers.workspaceOf(caller.id));
    },
  );

  registerApi(
    createServices({
      cm,
      operations,
      reviews: new ReviewStore(join(app.getPath('userData'), 'review-snapshots')),
      diffReviews: new DiffReviewStore(join(app.getPath('userData'), 'review-snapshots', 'diffs')),
      settings,
      watchers,
      windows,
      headers,
    }),
  );

  followAppTheme(settings);
  installAppMenu(windows);
  windows.openFirst();
  // macOS keeps the app running with no window; clicking the Dock icon then opens the home screen.
  app.on('activate', () => windows.all().length === 0 && windows.open());
}

// One running app per user: a second launch focuses the existing window. Development builds skip
// this so several instances (e.g. automated UI checks) can run side by side.
if (app.isPackaged && !app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => windows.focusAny());
  // Registered before the app is ready: opening a recent workspace from the Dock can be what launches it.
  handleRecentDocumentRequests(windows);
  app.whenReady().then(start);
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => cm.dispose());
