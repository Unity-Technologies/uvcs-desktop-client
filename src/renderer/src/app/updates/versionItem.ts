import type { UpdateStatus } from '@shared/domain/appUpdate';
import { APP_NAME } from '../../lib/appIdentity';

export interface VersionItem {
  label: string;
  tip: string;
  detail: string;
  /** An update waits to be installed: the item stands out, in the accent. */
  updateReady: boolean;
}

/**
 * The status bar's last item: the running version, which opens About (and its Check for Updates). Once an update is
 * downloaded it says so until the app restarts into it: the corner card can be put off ("Later"), this stays, quietly.
 * While one downloads it stays the version: the card shows the progress.
 */
export function versionItem(version: string, status: UpdateStatus): VersionItem {
  if (status.state === 'ready' || status.state === 'waitingToInstall') {
    return { label: 'Update ready', tip: `Version ${status.version} is ready to install`, detail: `Running ${version}`, updateReady: true };
  }
  return { label: `v${version}`, tip: `About ${APP_NAME}`, detail: 'Check for updates', updateReady: false };
}
