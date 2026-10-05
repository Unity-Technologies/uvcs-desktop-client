import type { UpdateStatus } from '@shared/domain/appUpdate';

export type UpdateCardStatus = Extract<UpdateStatus, { state: 'downloading' | 'ready' | 'waitingToInstall' }>;

/**
 * What the update card in the corner shows: an update downloading, then ready to install until the user puts that
 * version off ("Later", `dismissedVersion`); a newer one shows again. Once asked to install, it stays until the app
 * restarts, while waiting for an operation to finish (`waitingToInstall`). Checks and their answers show in the About
 * dialog, or as a toast in the window that asked (`checkFeedback`). While a dialog shows the update itself (About,
 * What's New: `updateInDialog`) the card steps aside: it would say the same, over the dialog's own buttons.
 */
export function updateCardOf(status: UpdateStatus, dismissedVersion: string | null, updateInDialog: boolean): UpdateCardStatus | null {
  if (updateInDialog) return null;
  if (status.state === 'downloading' || status.state === 'waitingToInstall') return status;
  if (status.state === 'ready' && status.version !== dismissedVersion) return status;
  return null;
}

/** What installing a downloaded update is called, on the card and in the About dialog alike. */
export function installLabel(install: 'restart' | 'installer'): string {
  return install === 'restart' ? 'Restart & Install' : 'Open Installer';
}
