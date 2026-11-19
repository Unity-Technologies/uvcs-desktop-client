import { readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { app, net, shell } from 'electron';
import { appLog } from '../diagnostics/appLog';
import { sendEvent } from '../ipc/sendEvent';
import type { CmRuntime } from '../cmRuntime/CmRuntime';
import { AppUpdates, type AppUpdatesDependencies, type UpdateFeed } from './AppUpdates';
import { downloadInstaller } from './downloadInstaller';
import { installerAsset } from './installerAsset';
import { needsManualInstall } from './macSignature';
import { previewUpdateFeed, previewUpdateFile, previewUpdateOf } from './previewUpdateFeed';
import { readReleaseCmPin } from './releaseCmPin';
import { releaseFileUrl } from './releaseFeed';
import { removeLeftoverStagingUserId, withoutStagingUserId } from './withoutStagingUserId';

/** The operations changing a workspace, which installing waits for (`OperationTracker`), and what quitting to install does first. */
type AroundInstalling = Pick<AppUpdatesDependencies, 'writesRunning' | 'writesFinished' | 'beforeRestart'>;

/** The app's `cm`, which downloads the one an update runs along with it (`CmRuntime.prefetchFor`). */
type CmPrefetching = Pick<CmRuntime, 'prefetchFor'>;

/** The app's updates (`AppUpdates`) over electron-updater and Electron; they check on their own once started (`checkPeriodically`). */
export function createAppUpdates(aroundInstalling: AroundInstalling, cmRuntime: CmPrefetching): AppUpdates {
  removeLeftoverStagingUserId(app.getPath('userData')).catch((error: unknown) => console.warn('[updates] The old staging user id stays:', error));

  // Development only: an unpackaged app has no feed, unless a file describes an update to preview (`PREVIEW_UPDATE_VARIABLE`).
  const previewFile = previewUpdateFile(app.isPackaged, process.env);

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
    // A preview's release isn't published: it has no pin to read.
    cmPrefetchFor: async (version) => {
      const pin = previewFile ? null : await readReleaseCmPin(version, (url) => net.fetch(url));
      return pin && cmRuntime.prefetchFor(pin);
    },
    ...aroundInstalling,
    // A preview never installs: quitting afterwards must not reopen the windows as a restart to install would.
    beforeRestart: previewFile ? () => undefined : aroundInstalling.beforeRestart,
    push: (status) => sendEvent('updateStatusChanged', status),
    logFailure: (text) => {
      console.warn(text);
      appLog.write(text);
    },
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

