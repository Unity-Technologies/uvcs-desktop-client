import type { OfficialUpdate, OfficialUpdateFailure } from '@shared/domain/officialUpdate';
import { formatSize } from '../../lib/formatDate';

/**
 * The words for the installed Unity Version Control's update, the same on the update screen and Settings' card
 * (docs/features/cm-runtime.md "Updating the installed one"). Never `cm`, installer, bundle or token.
 */

/** Why it couldn't be updated, and what to do next. */
export const UPDATE_FAILURE_REASONS: Readonly<Record<OfficialUpdateFailure, string>> = {
  noUpdate: 'There’s no newer version to install yet.',
  unreachable: 'The update couldn’t be downloaded. Check your connection, then try again.',
  notSigned: 'The download isn’t signed by Unity, so it wasn’t installed. Try again to download a new copy.',
  declined: 'Installing it needs your permission. Try again, and allow it when your computer asks.',
  notUpdated: 'Close the other Unity Version Control apps, then try again. This computer may also not allow installing programs.',
  notFinished: 'The update wasn’t installed. Try again, and finish every step it asks for.',
};

/** How far a download is, 0 to 1; null before its size is known. */
export function downloadFraction(update: Extract<OfficialUpdate, { kind: 'downloading' }>): number | null {
  return update.totalBytes ? Math.min(1, update.receivedBytes / update.totalBytes) : null;
}

/** "48 MB of 512 MB", or what arrived so far before the size is known; null before anything arrived. */
export function downloadSizes(update: Extract<OfficialUpdate, { kind: 'downloading' }>): string | null {
  if (update.totalBytes) return `${formatSize(update.receivedBytes)} of ${formatSize(update.totalBytes)}`;
  return update.receivedBytes > 0 ? formatSize(update.receivedBytes) : null;
}

/** "42%" of a download, or nothing before its size is known. */
export function downloadPercent(update: Extract<OfficialUpdate, { kind: 'downloading' }>): string {
  const fraction = downloadFraction(update);
  return fraction === null ? '' : ` ${Math.floor(fraction * 100)}%`;
}

/** Whether the user asked for the update and it runs: the download it waits for, or the installer. */
export function isUpdating(update: OfficialUpdate | undefined): boolean {
  if (update?.kind === 'installing') return true;
  return (update?.kind === 'lookingUp' || update?.kind === 'downloading') && update.installRequested;
}
