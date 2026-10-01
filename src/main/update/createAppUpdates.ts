import { basename, join } from 'node:path';
import { app, net, shell } from 'electron';
import { autoUpdater } from 'electron-updater';
import { sendEvent } from '../ipc/sendEvent';
import { AppUpdates } from './AppUpdates';
import { downloadInstaller } from './downloadInstaller';
import { installerAsset } from './installerAsset';
import { needsManualInstall } from './macSignature';
import { releaseFileUrl } from './releaseFeed';

/** The app's updates (`AppUpdates`) over electron-updater and Electron; they check on their own once started (`checkPeriodically`). */
export function createAppUpdates(): AppUpdates {
  // `AppUpdates` downloads once it knows how the update will install (`needsManualInstall`).
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  // The notes of every release since the running one, not just the latest: an update may skip a few.
  autoUpdater.fullChangelog = true;

  return new AppUpdates({
    feed: autoUpdater,
    packaged: app.isPackaged,
    needsManualInstall: async () => process.platform === 'darwin' && needsManualInstall(process.execPath),
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
    push: (status) => sendEvent('updateStatusChanged', status),
    logFailure: (text) => console.warn(text),
  });
}
