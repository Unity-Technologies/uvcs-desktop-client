import type { CmChoice, CmSource } from '@shared/domain/cmRuntime';

export interface CmCandidates {
  /** `UVCS_CM_PATH`, which overrides everything: development, the smoke test's fake `cm`. */
  environmentPath: string | undefined;
  /** What the user chose in Settings. */
  choice: CmChoice;
  /** The `cm` installed on the computer (`findInstalledCm`), null when none was found. */
  installedPath: string | null;
  /** The app's own `cm` of the pinned version, null when there is no bundle for this platform (Linux arm64). */
  managedPath: string | null;
}

export interface ChosenCm {
  source: CmSource;
  /** The executable; a bare `cm` when nothing was found, so starting it fails with "not found". */
  path: string;
}

/**
 * Which `cm` runs (docs/features/cm-runtime.md "Which cm runs"): `UVCS_CM_PATH`, then the installed one if the user chose
 * it and one is there, then the app's own; where the app has none, the installed one, found or not.
 */
export function chooseCm(candidates: CmCandidates, bareName: string): ChosenCm {
  const { environmentPath, choice, installedPath, managedPath } = candidates;
  if (environmentPath) return { source: 'environment', path: environmentPath };
  if (choice === 'installed' && installedPath) return { source: 'installed', path: installedPath };
  if (managedPath) return { source: 'managed', path: managedPath };
  return { source: 'installed', path: installedPath ?? bareName };
}
