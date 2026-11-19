import { meetsCmVersion, type CmChoice, type CmSource, type InstalledCm, type OwnCmSwitch } from '@shared/domain/cmRuntime';

/** One card of Settings' choice of which Unity Version Control the app runs (`cmChoice`). */
export interface CmChoiceCard {
  choice: CmChoice;
  label: string;
  description: string;
  /** The description in full, or why the card can't be chosen. */
  tip?: string;
  disabled: boolean;
  selected: boolean;
  /** Drawn in the caution color: its own download failed, or the installed one is too old to choose. */
  warning: boolean;
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

function managedCard({ pinnedVersion, source, switchingToOwn }: CmChoiceFacts): CmChoiceCard {
  const base = { choice: 'managed' as const, label: 'Included with the app', selected: source === 'managed', warning: false };
  if (pinnedVersion === null) return { ...base, description: 'Not available on this computer', disabled: true };
  if (switchingToOwn?.kind === 'downloading') {
    const percent = switchingToOwn.fraction === null ? '' : ` ${Math.floor(switchingToOwn.fraction * 100)}%`;
    return { ...base, description: `Downloading version ${pinnedVersion}…${percent}`, disabled: true };
  }
  if (switchingToOwn?.kind === 'failed') {
    return { ...base, description: 'Couldn’t download it. Choose it to try again.', tip: switchingToOwn.detail, disabled: false, warning: true };
  }
  return { ...base, description: `Version ${pinnedVersion}, updated with the app`, disabled: false };
}

function installedCard({ pinnedVersion, installed, source }: CmChoiceFacts): CmChoiceCard {
  const base = { choice: 'installed' as const, label: 'Installed on this computer', selected: source === 'installed', warning: false };
  if (installed === undefined) return { ...base, description: 'Looking…', disabled: true };
  if (installed === null) return { ...base, description: 'Not found on this computer', disabled: true };
  // Never one older than the app's own (`CmRuntime.use` refuses it too): any feature may rely on a newer `cm`.
  if (pinnedVersion !== null && !meetsCmVersion(installed.version, pinnedVersion)) {
    return {
      ...base,
      description: `Version ${installed.version} is older than this app needs`,
      tip: `Update it to version ${pinnedVersion} or later to use it. ${installed.path}`,
      disabled: true,
      warning: true,
    };
  }
  return { ...base, description: `Version ${installed.version} · ${installed.path}`, tip: installed.path, disabled: false };
}

/**
 * The two cards, the one running checked. `UVCS_CM_PATH` (development, the smoke test) overrides both: neither is
 * checked then, and `cmChoiceNote` says why.
 */
export function cmChoiceCards(facts: CmChoiceFacts): CmChoiceCard[] {
  return [managedCard(facts), installedCard(facts)];
}

/** A line under the cards when the choice doesn't apply; null when it does. */
export function cmChoiceNote(source: CmSource): string | null {
  return source === 'environment' ? 'UVCS_CM_PATH is set: the app runs that one, whatever is chosen here.' : null;
}
