import { compareCmVersions, type CmChoice, type CmSource, type InstalledCm } from '@shared/domain/cmRuntime';

/** One card of Settings' choice of which Unity Version Control the app runs (`cmChoice`). */
export interface CmChoiceCard {
  choice: CmChoice;
  label: string;
  description: string;
  /** The description in full, or why the card can't be chosen. */
  tip?: string;
  disabled: boolean;
  selected: boolean;
  /** The installed one is older than the app's own: newer features may not work with it. */
  warning: boolean;
}

export interface CmChoiceFacts {
  /** The version the app includes; null where it has none of its own (Linux on Arm). */
  pinnedVersion: string | null;
  /** The one installed on the computer; undefined while it's looked for, null when there is none. */
  installed: InstalledCm | null | undefined;
  /** The one running now. */
  source: CmSource;
}

function managedCard({ pinnedVersion, source }: CmChoiceFacts): CmChoiceCard {
  const base = { choice: 'managed' as const, label: 'Included with the app', selected: source === 'managed', warning: false };
  if (pinnedVersion === null) return { ...base, description: 'Not available on this computer', disabled: true };
  return { ...base, description: `Version ${pinnedVersion}, updated with the app`, disabled: false };
}

function installedCard({ pinnedVersion, installed, source }: CmChoiceFacts): CmChoiceCard {
  const base = { choice: 'installed' as const, label: 'Installed on this computer', selected: source === 'installed', warning: false };
  if (installed === undefined) return { ...base, description: 'Looking…', disabled: true };
  if (installed === null) return { ...base, description: 'Not found on this computer', disabled: true };
  const older = pinnedVersion !== null && compareCmVersions(installed.version, pinnedVersion) < 0;
  return {
    ...base,
    description: `Version ${installed.version} · ${installed.path}`,
    tip: older ? `Older than the one included with the app: newer features may not work with it. ${installed.path}` : installed.path,
    disabled: false,
    warning: older,
  };
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
