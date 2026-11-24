import { CM_SETUP_DOWNLOAD_SHARE, type CmRuntimeStatus } from '@shared/domain/cmRuntime';
import type { OfficialUpdate } from '@shared/domain/officialUpdate';
import { UNMEASURED, type IconProgress } from '../window/iconProgress';

/**
 * The installed one's update, once the user asked for it: its download, then the installer running, unmeasured. A
 * download in the background shows nothing.
 */
function officialUpdateIconProgress(update: OfficialUpdate | undefined): IconProgress | null {
  if (update?.kind === 'installing' || (update?.kind === 'lookingUp' && update.installRequested)) return UNMEASURED;
  if (update?.kind !== 'downloading' || !update.installRequested) return null;
  if (update.totalBytes === null) return UNMEASURED;
  return { mode: 'measured', value: CM_SETUP_DOWNLOAD_SHARE * Math.min(1, update.receivedBytes / update.totalBytes) };
}

/**
 * What the app's icon shows of the setup (the Dock, the taskbar button): how far the download is, its last stretch
 * while finishing; nothing once it's done or failed, which the window says. The installed one's update shows the same.
 */
export function cmSetupIconProgress(status: CmRuntimeStatus): IconProgress | null {
  if (status.kind === 'installedTooOld' || status.kind === 'ready') return officialUpdateIconProgress(status.officialUpdate);
  if (status.kind !== 'installing') return null;
  if (status.phase === 'finishing') return { mode: 'measured', value: CM_SETUP_DOWNLOAD_SHARE };
  if (status.totalBytes === null) return UNMEASURED;
  return { mode: 'measured', value: CM_SETUP_DOWNLOAD_SHARE * Math.min(1, status.receivedBytes / status.totalBytes) };
}
