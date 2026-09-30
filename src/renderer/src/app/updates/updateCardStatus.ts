import type { UpdateStatus } from '@shared/domain/appUpdate';

export type UpdateCardStatus = Extract<UpdateStatus, { state: 'downloading' | 'ready' }>;

/**
 * What the update card in the corner shows: an update downloading, then ready to install until the user puts that
 * version off ("Later", `dismissedVersion`); a newer one shows again. Checks and their answers show in the About
 * dialog, or as a toast in the window that asked (`checkFeedback`).
 */
export function updateCardOf(status: UpdateStatus, dismissedVersion: string | null): UpdateCardStatus | null {
  if (status.state === 'downloading') return status;
  if (status.state === 'ready' && status.version !== dismissedVersion) return status;
  return null;
}

/** What installing a downloaded update is called, on the card and in the About dialog alike. */
export function installLabel(install: 'restart' | 'installer'): string {
  return install === 'restart' ? 'Restart & Install' : 'Open Installer';
}
