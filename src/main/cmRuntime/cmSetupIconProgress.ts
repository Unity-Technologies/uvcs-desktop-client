import { CM_SETUP_DOWNLOAD_SHARE, type CmRuntimeStatus } from '@shared/domain/cmRuntime';
import { UNMEASURED, type IconProgress } from '../window/iconProgress';

/**
 * What the app's icon shows of the setup (the Dock, the taskbar button): how far the download is, its last stretch
 * while finishing; nothing once it's done or failed, which the window says.
 */
export function cmSetupIconProgress(status: CmRuntimeStatus): IconProgress | null {
  if (status.kind !== 'installing') return null;
  if (status.phase === 'finishing') return { mode: 'measured', value: CM_SETUP_DOWNLOAD_SHARE };
  if (status.totalBytes === null) return UNMEASURED;
  return { mode: 'measured', value: CM_SETUP_DOWNLOAD_SHARE * Math.min(1, status.receivedBytes / status.totalBytes) };
}
