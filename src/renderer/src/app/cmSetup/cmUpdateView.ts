import type { CmRuntimeStatus } from '@shared/domain/cmRuntime';
import { installedAndInstallingText, installedAndNeededText } from '@shared/domain/cmVersionWords';
import { checkAgainLabel, TRY_AGAIN_LABEL, UPDATE_LABEL, USE_INCLUDED_FOR_NOW_LABEL } from './cmScreenLabels';
import { downloadFraction, downloadPercent, downloadSizes, isUpdating, UPDATE_FAILURE_REASONS } from './officialUpdateWords';

export type CmTooOld = Extract<CmRuntimeStatus, { kind: 'installedTooOld' }>;

/** Where the user's last Check Again stands: none yet, reading the version, or it found the same old one. */
export type CmUpdateCheck = 'none' | 'checking' | 'stillTooOld';

/** The words every kind shows on top. */
interface Heading {
  title: string;
  body: string;
  /** "Installed: 11.0.16.9000 · Needed: 11.0.16.10659 or later", or the version being installed. */
  versions: string;
}

/**
 * What the update screen shows when the Unity Version Control installed on the computer is older than the app needs
 * (docs/features/cm-runtime.md "The update screen"). Its words never say `cm`, command line, installer or bundle; the
 * versions show on a line of their own (`cmVersionWords`), the installed one's path and any error under Details.
 */
export type CmUpdateView =
  /** Update, or the included version for now; the update downloads meanwhile (`background`). */
  | (Heading & { kind: 'offer'; hint: string; updateLabel: string; includedLabel: string; background: string | null; detail: string })
  /** The user pressed Update: its download, then the installer, which the app waits for. */
  | (Heading & { kind: 'updating'; fraction: number | null; progress: string | null })
  /** Its body says why, and what to do next. */
  | (Heading & { kind: 'failed'; hint: string; tryAgainLabel: string; includedLabel: string; detail: string })
  /** Linux: no installer; the command that updates it, and Check Again, also asked as the window gains focus. */
  | (Heading & {
      kind: 'byCommand';
      hint: string;
      commandNote: string;
      /** Null while it's being found. */
      command: string | null;
      checkAgainLabel: string;
      checking: boolean;
      includedLabel: string;
      detail: string;
    });

const TITLE = 'Update Unity Version Control';
const BODY = 'This app needs a newer version of Unity Version Control on this computer.';

/** The line under the buttons while the update downloads in the background, or once it's ready. */
function backgroundLine(update: CmTooOld['officialUpdate']): string | null {
  if (update?.kind === 'downloading') return `Downloading the update…${downloadPercent(update)}`;
  if (update?.kind === 'downloaded') return 'The update is ready to install.';
  return null;
}

function updatingView(status: CmTooOld): CmUpdateView {
  const update = status.officialUpdate!;
  const versions = update.kind === 'downloading' || update.kind === 'installing' ? installedAndInstallingText(status.installed.version, update.version) : installedAndNeededText(status.installed.version, status.requiredVersion);
  const heading = { title: 'Updating Unity Version Control…', versions };
  if (update.kind === 'installing') return { kind: 'updating', ...heading, body: 'Your computer may ask for permission.', fraction: null, progress: null };
  const downloading = update.kind === 'downloading';
  return {
    kind: 'updating',
    ...heading,
    body: 'Downloading the update…',
    fraction: downloading ? downloadFraction(update) : null,
    progress: downloading ? downloadSizes(update) : null,
  };
}

function failedView(status: CmTooOld, update: Extract<NonNullable<CmTooOld['officialUpdate']>, { kind: 'failed' }>): CmUpdateView {
  const { installed, requiredVersion } = status;
  return {
    kind: 'failed',
    title: 'Couldn’t update Unity Version Control',
    body: UPDATE_FAILURE_REASONS[update.failure],
    versions: installedAndNeededText(installed.version, requiredVersion),
    hint: 'You can keep working with the version included with the app.',
    tryAgainLabel: TRY_AGAIN_LABEL,
    includedLabel: USE_INCLUDED_FOR_NOW_LABEL,
    detail: `${update.detail}\n${installed.path}`,
  };
}

function byCommandView(status: CmTooOld, check: CmUpdateCheck): CmUpdateView {
  const { installed, requiredVersion, officialUpdate } = status;
  return {
    kind: 'byCommand',
    title: TITLE,
    body: BODY,
    versions: installedAndNeededText(installed.version, requiredVersion),
    hint: check === 'stillTooOld' ? 'It still needs an update. Update it, then check again.' : 'Update it in a terminal, then come back to this window. You can also keep working with the version included with the app.',
    commandNote: 'Run this in a terminal:',
    command: officialUpdate?.kind === 'byCommand' ? officialUpdate.command : null,
    checkAgainLabel: checkAgainLabel(check === 'checking'),
    checking: check === 'checking',
    includedLabel: USE_INCLUDED_FOR_NOW_LABEL,
    detail: installed.path,
  };
}

/**
 * Where Check Again leaves the screen once it read the version, from the status then: still asking for the update says
 * so; anything else moved on by itself.
 */
export function checkAgainOutcome(statusKind: CmRuntimeStatus['kind']): CmUpdateCheck {
  return statusKind === 'installedTooOld' ? 'stillTooOld' : 'none';
}

/**
 * The update screen's view. Where main says the installed one updates by a command (Linux, which has no installer to
 * run: `updatesBy`), the screen shows that command instead of Update.
 */
export function cmUpdateViewOf(status: CmTooOld, check: CmUpdateCheck): CmUpdateView {
  if (status.updatesBy !== 'installer') return byCommandView(status, check);
  const update = status.officialUpdate;
  if (update?.kind === 'failed') return failedView(status, update);
  if (isUpdating(update)) return updatingView(status);
  const { installed, requiredVersion } = status;
  return {
    kind: 'offer',
    title: TITLE,
    body: BODY,
    versions: installedAndNeededText(installed.version, requiredVersion),
    hint: 'It takes a minute, and your workspaces aren’t changed.',
    updateLabel: UPDATE_LABEL,
    includedLabel: USE_INCLUDED_FOR_NOW_LABEL,
    background: backgroundLine(update),
    detail: installed.path,
  };
}
