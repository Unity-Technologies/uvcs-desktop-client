import { CM_SETUP_DOWNLOAD_SHARE, retriesByItself, type CmInstallFailure, type CmRuntimeStatus } from '@shared/domain/cmRuntime';
import { formatSize } from '../../lib/formatDate';
import { TRY_AGAIN_LABEL, useInstalledLabel } from './cmScreenLabels';

/**
 * What the setup screen shows while the app sets up its own Unity Version Control (docs/features/cm-runtime.md "The
 * setup screen"). Its words never say `cm`, command line, bundle or install: to the user, the app is getting itself
 * ready.
 */
export type CmSetupView =
  | {
      kind: 'progress';
      title: string;
      subtitle: string;
      /** How far the bar is, 0 to 1; null while the download's size isn't known yet. */
      fraction: number | null;
      /** Unpacking and checking: the bar holds its last stretch, which moves without a measure. */
      finishing: boolean;
      /** "48 MB of 78 MB · 12 s left", "Finishing…"; null before anything arrived. */
      detail: string | null;
    }
  | {
      kind: 'failed';
      title: string;
      reason: string;
      /** It tries again by itself (the network's failures): the screen says so, and Try Again stays. */
      retriesByItself: boolean;
      tryAgainLabel: string;
      /** The button that runs the installed one instead, naming its version; null when none is found. */
      useInstalledLabel: string | null;
      /** What failed, folded under Details. */
      detail: string;
    };

function titleOf(firstRun: boolean): string {
  return firstRun ? 'Setting up Unity Version Control' : 'Updating Unity Version Control';
}

function subtitleOf(firstRun: boolean): string {
  return firstRun ? 'This happens once and takes a moment.' : 'A newer version came with this update.';
}

/** Seconds left as people say them: "12 s left", then whole minutes. */
export function timeLeftText(seconds: number): string {
  if (seconds < 60) return `${Math.max(1, Math.round(seconds))} s left`;
  return `${Math.ceil(seconds / 60)} min left`;
}

const REASONS: Readonly<Record<CmInstallFailure, string>> = {
  offline: 'This computer is offline. Setup goes on by itself once it’s back online.',
  unreachable: 'The download site didn’t answer. Setup tries again by itself.',
  proxyAuthentication: 'A proxy on this network asks for a sign-in. Ask whoever runs the network to allow downloads from plasticscm.com.',
  diskFull: 'The disk is full. Free some space, about 400 MB, and try again.',
  notWritable: 'The app can’t write to its folder on this computer. Check that it’s yours to write to, and try again.',
  damaged: 'What arrived isn’t what was published. Try again.',
  unavailable: 'This version isn’t available to download right now.',
  blocked: 'It downloaded, but didn’t start on this computer, which may block apps in your user folder or lack something they need: Details say what.',
};

/** What the setup shows; null once `cm` runs, or while the update screen asks to update the installed one (`cmUpdateViewOf`). */
export function cmSetupViewOf(status: CmRuntimeStatus, secondsLeft: number | null): CmSetupView | null {
  if (status.kind === 'ready' || status.kind === 'installedTooOld') return null;
  if (status.kind === 'failed') {
    return {
      kind: 'failed',
      title: status.firstRun ? 'Unity Version Control couldn’t be set up' : 'Unity Version Control couldn’t be updated',
      reason: REASONS[status.failure],
      retriesByItself: retriesByItself(status.failure),
      tryAgainLabel: TRY_AGAIN_LABEL,
      useInstalledLabel: status.installedCm && useInstalledLabel(status.installedCm.version),
      detail: status.detail,
    };
  }
  const base = { kind: 'progress' as const, title: titleOf(status.firstRun), subtitle: subtitleOf(status.firstRun) };
  if (status.phase === 'finishing') return { ...base, fraction: CM_SETUP_DOWNLOAD_SHARE, finishing: true, detail: 'Finishing…' };
  const { receivedBytes, totalBytes } = status;
  if (totalBytes === null) return { ...base, fraction: null, finishing: false, detail: receivedBytes > 0 ? formatSize(receivedBytes) : null };
  const sizes = `${formatSize(receivedBytes)} of ${formatSize(totalBytes)}`;
  return {
    ...base,
    fraction: CM_SETUP_DOWNLOAD_SHARE * Math.min(1, receivedBytes / totalBytes),
    finishing: false,
    detail: secondsLeft === null ? sizes : `${sizes} · ${timeLeftText(secondsLeft)}`,
  };
}
