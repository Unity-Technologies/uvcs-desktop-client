import { readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { app, net, shell } from 'electron';
import { sendEvent } from '../ipc/sendEvent';
import { AppUpdates, type AppUpdatesDependencies, type UpdateFeed } from './AppUpdates';
import { downloadInstaller } from './downloadInstaller';
import { installerAsset } from './installerAsset';
import { needsManualInstall } from './macSignature';
import { PREVIEW_UPDATE_VARIABLE, previewUpdateFeed, previewUpdateOf } from './previewUpdateFeed';
import { releaseFileUrl } from './releaseFeed';
import { removeLeftoverStagingUserId, withoutStagingUserId } from './withoutStagingUserId';

/** The operations changing a workspace, which installing waits for (`OperationTracker`), and what quitting to install does first. */
type AroundInstalling = Pick<AppUpdatesDependencies, 'writesRunning' | 'writesFinished' | 'beforeRestart'>;

/** The app's updates (`AppUpdates`) over electron-updater and Electron; they check on their own once started (`checkPeriodically`). */
export function createAppUpdates(aroundInstalling: AroundInstalling): AppUpdates {
  removeLeftoverStagingUserId(app.getPath('userData')).catch((error: unknown) => console.warn('[updates] The old staging user id stays:', error));

  // Development only: an unpackaged app has no feed, unless a file describes an update to preview (`PREVIEW_UPDATE_VARIABLE`).
  const previewFile = app.isPackaged ? undefined : process.env[PREVIEW_UPDATE_VARIABLE];

  return new AppUpdates({
    loadFeed: previewFile ? async () => previewUpdateFeed(previewUpdateOf(JSON.parse(await readFile(previewFile, 'utf8')))) : loadAutoUpdater,
    packaged: app.isPackaged || previewFile !== undefined,
    needsManualInstall: async () => !previewFile && process.platform === 'darwin' && needsManualInstall(process.execPath),
    installerOf: (files) => installerAsset(files, process.arch, app.runningUnderARM64Translation),
    downloadInstaller: async (file, version, onProgress) => {
      // In Downloads, where the user finds it again if they close the disk image before installing.
      const destination = join(app.getPath('downloads'), basename(file.url));
      // Electron's net, as electron-updater's own downloads: it goes through the system's proxy.
      await downloadInstaller((url) => net.fetch(url), { ...file, url: releaseFileUrl(version, file.url), destination }, onProgress);
      return destination;
    },
    openInstaller: async (path) => {
      const error = await shell.openPath(path);
      if (error) throw new Error(error);
      app.quit();
    },
    ...aroundInstalling,
    push: (status) => sendEvent('updateStatusChanged', status),
    logFailure: (text) => console.warn(text),
  });
}

/** electron-updater's `autoUpdater`, loaded as `AppUpdates` first needs it (`loadFeed`) and set up for it. */
async function loadAutoUpdater(): Promise<UpdateFeed> {
  const { autoUpdater } = await import('electron-updater');
  // `AppUpdates` downloads once it knows how the update will install (`needsManualInstall`).
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  // The notes of every release since the running one, not just the latest: an update may skip a few.
  autoUpdater.fullChangelog = true;
  // A check is a standard request: no installation id.
  withoutStagingUserId(autoUpdater);
  return autoUpdater;
}

