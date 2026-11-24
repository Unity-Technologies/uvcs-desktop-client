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
  /** Drawn in the caution color: its own download failed, or the installed one needs an update. */
  warning: boolean;
}

export interface CmChoiceFacts {
  /** What the user chose (`cmChoice`). */
  choice: CmChoice;
  /** The version the app includes; null where it has none of its own (Linux on Arm). */
  pinnedVersion: string | null;
  /** The one installed on the computer; undefined while it's looked for, null when there is none. */
  installed: InstalledCm | null | undefined;
  /** The one running now. */
  source: CmSource;
  /** The app's own downloading to replace the installed one, or why it couldn't. */
  switchingToOwn?: OwnCmSwitch;
}

const AUTOMATIC_TIP = 'The version installed on this computer, or the one included with the app when none is installed.';

/** What the automatic choice runs, from what's installed: the installed one, or the app's own when there's none or it's too old. */
function automaticCard({ choice, pinnedVersion, installed, source }: CmChoiceFacts): CmChoiceCard {
  const base = { choice: 'automatic' as const, label: 'Automatic', tip: AUTOMATIC_TIP, selected: source !== 'environment' && choice === 'automatic', disabled: false, warning: false };
  if (installed === undefined) return { ...base, description: 'Looking…' };
  if (installed === null) {
    if (pinnedVersion === null) return { ...base, description: 'Not found on this computer', warning: true };
    return { ...base, description: `Version ${pinnedVersion}, included with the app: none is installed` };
  }
  // Never one older than the app's own (`CmRuntime.admits`): any feature may rely on a newer `cm`.
  if (pinnedVersion !== null && !meetsCmVersion(installed.version, pinnedVersion)) {
    return { ...base, description: `Installed version ${installed.version} needs an update to ${pinnedVersion} or later`, tip: `${AUTOMATIC_TIP} ${installed.path}`, warning: true };
  }
  return { ...base, description: `Version ${installed.version}, installed on this computer`, tip: `${AUTOMATIC_TIP} ${installed.path}` };
}

function managedCard({ choice, pinnedVersion, source, switchingToOwn }: CmChoiceFacts): CmChoiceCard {
  const base = { choice: 'managed' as const, label: 'Included with the app', selected: source !== 'environment' && pinnedVersion !== null && choice === 'managed', warning: false };
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

/**
 * The two cards, the one chosen checked: Automatic (the default) and the one included with the app. `UVCS_CM_PATH`
 * (development, the smoke test) overrides both: neither is checked then, and `cmChoiceNote` says why.
 */
export function cmChoiceCards(facts: CmChoiceFacts): CmChoiceCard[] {
  return [automaticCard(facts), managedCard(facts)];
}

/** A line under the cards when the choice doesn't apply; null when it does. */
export function cmChoiceNote(source: CmSource): string | null {
  return source === 'environment' ? 'UVCS_CM_PATH is set: the app runs that one, whatever is chosen here.' : null;
}
