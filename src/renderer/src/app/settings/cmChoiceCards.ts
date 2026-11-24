import { meetsCmVersion, type CmSource, type CmUserChoice, type InstalledCm, type OwnCmSwitch } from '@shared/domain/cmRuntime';
import { versionAndNeededText, versionText } from '@shared/domain/cmVersionWords';

/** One card of Settings' choice of which Unity Version Control the app runs (`cmChoice`). */
export interface CmChoiceCard {
  choice: CmUserChoice;
  label: string;
  description: string;
  /** The description in full, or why the card can't be chosen. */
  tip?: string;
  disabled: boolean;
  /** Checked: the one that runs, chosen or not. */
  selected: boolean;
  /** Drawn in the caution color: its own download failed, or the installed one needs an update. */
  warning: boolean;
  /** The installed one is older than the app needs: the card is where updating it is offered. */
  needsUpdate: boolean;
}

export interface CmChoiceFacts {
  /** The version the app includes; null where it has none of its own (Linux on Arm). */
  pinnedVersion: string | null;
  /** The one installed on the computer; undefined while it's looked for, null when there is none. */
  installed: InstalledCm | null | undefined;
  /** The one running now. */
  source: CmSource;
  /** The app's own downloading to replace the installed one, or why it couldn't. */
  switchingToOwn?: OwnCmSwitch;
}

function installedCard({ pinnedVersion, installed, source }: CmChoiceFacts): CmChoiceCard {
  const base = { choice: 'installed' as const, label: 'Installed on this computer', selected: source === 'installed', warning: false, needsUpdate: false };
  if (installed === undefined) return { ...base, description: 'Looking…', disabled: true };
  if (installed === null) return { ...base, description: 'Not found on this computer', disabled: true };
  // Never one older than the app's own (`CmRuntime.use` refuses it too): any feature may rely on a newer `cm`.
  if (pinnedVersion !== null && !meetsCmVersion(installed.version, pinnedVersion)) {
    return {
      ...base,
      description: versionAndNeededText(installed.version, pinnedVersion),
      tip: `Older than this app needs. Update it to use it. ${installed.path}`,
      disabled: true,
      warning: true,
      needsUpdate: true,
    };
  }
  return { ...base, description: `${versionText(installed.version)} · ${installed.path}`, tip: installed.path, disabled: false };
}

function managedCard({ pinnedVersion, source, switchingToOwn }: CmChoiceFacts): CmChoiceCard {
  const base = { choice: 'managed' as const, label: 'Included with the app', selected: source === 'managed', warning: false, needsUpdate: false };
  if (pinnedVersion === null) return { ...base, description: 'Not available on this computer', disabled: true };
  if (switchingToOwn?.kind === 'downloading') {
    const percent = switchingToOwn.fraction === null ? '' : ` ${Math.floor(switchingToOwn.fraction * 100)}%`;
    return { ...base, description: `Downloading version ${pinnedVersion}…${percent}`, disabled: true };
  }
  if (switchingToOwn?.kind === 'failed') {
    return { ...base, description: 'Couldn’t download it. Choose it to try again.', tip: switchingToOwn.detail, disabled: false, warning: true };
  }
  return { ...base, description: `${versionText(pinnedVersion)}, updated with the app`, disabled: false };
}

/**
 * The two cards, the installed one first, as the one the app prefers, and the one that runs checked: until the user
 * chooses, that's the installed one when it's new enough and the included one otherwise. `UVCS_CM_PATH` (development,
 * the smoke test) overrides both: neither is checked then, and `cmChoiceNote` says why.
 */
export function cmChoiceCards(facts: CmChoiceFacts): CmChoiceCard[] {
  return [installedCard(facts), managedCard(facts)];
}

/** A line under the cards when the choice doesn't apply; null when it does. */
export function cmChoiceNote(source: CmSource): string | null {
  return source === 'environment' ? 'UVCS_CM_PATH is set: the app runs that one, whatever is chosen here.' : null;
}
