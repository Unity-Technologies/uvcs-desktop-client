import type { InstalledCmUpdate, UpdateStatus } from '@shared/domain/appUpdate';
import { installedAndNeededText } from '@shared/domain/cmVersionWords';
import { APP_NAME } from '../../lib/appIdentity';

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

/**
 * What the card says of the installed Unity Version Control when the update needs a newer one (docs/features/cm-runtime.md
 * "Updates bring their cm"): its installer comes with the update, or, on Linux, a command after the restart; and its
 * versions, as every place names them (`cmVersionWords`). Null when the update needs nothing of it.
 */
export function installedCmNoteOf(installedCm: InstalledCmUpdate | undefined): { text: string; versions: string } | null {
  if (!installedCm) return null;
  const text =
    installedCm.by === 'installer'
      ? 'This update also updates the Unity Version Control installed on this computer.'
      : 'After the restart, the app shows the command that updates the Unity Version Control installed on this computer.';
  return { text, versions: installedAndNeededText(installedCm.installedVersion, installedCm.neededVersion) };
}

/** The card once the user asked to install and it waits: for an operation to finish, or for the installed one's installer. */
export function waitingCardOf(card: Extract<UpdateCardStatus, { state: 'waitingToInstall' }>): { title: string; text: string | null } {
  if (card.waitingFor === 'operation') return { title: `${APP_NAME} ${card.version} installs once the operation finishes.`, text: null };
  return {
    title: 'Updating the Unity Version Control installed on this computer…',
    text: `Your computer may ask for permission. Then the app restarts into version ${card.version}.`,
  };
}
